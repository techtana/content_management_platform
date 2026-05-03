const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getDb } = require('../../config/db');
const { encrypt } = require('../../services/crypto');
const { validateToken } = require('../../services/github');
const { detectSsg, proposeSections } = require('../../services/ssgDetector');

function logError(route, err) {
  const status = err.status ?? err.response?.status ?? '—';
  console.error(`[setup] ${route} failed (HTTP ${status}): ${err.message}`);
  if (err.response?.data) console.error('[setup] GitHub response:', JSON.stringify(err.response.data, null, 2));
  if (err.stack) console.error(err.stack);
}

function dedupeSections(sections) {
  const seen = new Map();
  for (const s of sections) seen.set(s.slug, s);
  return [...seen.values()];
}
const { v4: uuidv4 } = require('uuid');

router.get('/status', (req, res) => {
  try {
    const db = getDb();
    const token = db.prepare("SELECT value FROM config WHERE key = 'github_token'").get();
    const sites = db.prepare('SELECT COUNT(*) as count FROM sites').get();
    res.json({
      setupComplete: !!token,
      hasSite: sites.count > 0,
    });
  } catch (err) {
    logError('GET /setup/status', err);
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/validate-token',
  [body('token').notEmpty().withMessage('token required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { token } = req.body;
      const { username, avatar } = await validateToken(token.trim());
      res.json({ username, avatar });
    } catch (err) {
      logError('POST /setup/validate-token', err);
      res.status(401).json({ error: 'Invalid token or GitHub API error: ' + err.message });
    }
  }
);

router.post(
  '/complete',
  [
    body('token').notEmpty(),
    body('site.repo_owner').notEmpty(),
    body('site.repo_name').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { token: rawToken, site } = req.body;
      const token = rawToken.trim();
      const { username, avatar } = await validateToken(token);

      const db = getDb();
      const set = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
      const setAll = db.transaction(rows => rows.forEach(([k, v]) => set.run(k, v)));
      setAll([
        ['github_token', encrypt(token)],
        ['github_username', username],
        ['github_avatar', avatar],
      ]);

      let savedSiteId = null;
      if (site.repo_owner !== '_pending_') {
        const newId = uuidv4();
        const existing = db.prepare('SELECT id FROM sites WHERE repo_owner=? AND repo_name=?').get(site.repo_owner, site.repo_name);
        savedSiteId = existing?.id || newId;
        db.prepare(`
          INSERT OR REPLACE INTO sites (id, repo_owner, repo_name, default_branch, ssg_type, site_type, sections_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          savedSiteId,
          site.repo_owner,
          site.repo_name,
          site.default_branch || 'main',
          site.ssg_type || 'unknown',
          site.site_type || 'blog',
          JSON.stringify(dedupeSections(site.sections || []))
        );
      }

      res.json({ ok: true, siteId: savedSiteId, username, avatar });
    } catch (err) {
      logError('POST /setup/complete', err);
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/reset', (req, res) => {
  try {
    const db = getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM audit_log').run();
      db.prepare('DELETE FROM ai_instructions').run();
      db.prepare('DELETE FROM ai_providers').run();
      db.prepare('DELETE FROM sites').run();
      db.prepare('DELETE FROM config').run();
    })();
    res.json({ ok: true });
  } catch (err) {
    logError('POST /setup/reset', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
