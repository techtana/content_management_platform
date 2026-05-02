const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getDb } = require('../../config/db');
const { encrypt } = require('../../services/crypto');
const { validateToken } = require('../../services/github');
const { detectSsg, proposeSections } = require('../../services/ssgDetector');
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
      const { username, avatar } = await validateToken(token);
      res.json({ username, avatar });
    } catch (err) {
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
      const { token, site } = req.body;
      const { username, avatar } = await validateToken(token);

      const db = getDb();
      const set = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
      const setAll = db.transaction(rows => rows.forEach(([k, v]) => set.run(k, v)));
      setAll([
        ['github_token', encrypt(token)],
        ['github_username', username],
        ['github_avatar', avatar],
      ]);

      const siteId = site.id || uuidv4();
      db.prepare(`
        INSERT OR REPLACE INTO sites (id, repo_owner, repo_name, default_branch, ssg_type, sections_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        siteId,
        site.repo_owner,
        site.repo_name,
        site.default_branch || 'main',
        site.ssg_type || 'unknown',
        JSON.stringify(site.sections || [])
      );

      res.json({ ok: true, siteId, username, avatar });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
