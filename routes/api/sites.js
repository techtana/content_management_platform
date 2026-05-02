const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../config/db');
const ensureApiAuth = require('../../middleware/ensureApiAuth');

router.use(ensureApiAuth);

router.get('/', (req, res) => {
  const db = getDb();
  const sites = db.prepare('SELECT * FROM sites ORDER BY created_at DESC').all();
  res.json(sites.map(parseSite));
});

router.post(
  '/',
  [body('repo_owner').notEmpty(), body('repo_name').notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const db = getDb();
    const id = uuidv4();
    const { repo_owner, repo_name, default_branch, ssg_type, sections } = req.body;
    db.prepare(`
      INSERT INTO sites (id, repo_owner, repo_name, default_branch, ssg_type, sections_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, repo_owner, repo_name, default_branch || 'main', ssg_type || 'unknown', JSON.stringify(dedupeSections(sections || [])));
    res.status(201).json(parseSite(db.prepare('SELECT * FROM sites WHERE id = ?').get(id)));
  }
);

router.get('/:id', (req, res) => {
  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  res.json(parseSite(site));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const { repo_owner, repo_name, default_branch, ssg_type, sections } = req.body;
  db.prepare(`
    UPDATE sites SET repo_owner=?, repo_name=?, default_branch=?, ssg_type=?, sections_json=? WHERE id=?
  `).run(
    repo_owner || site.repo_owner,
    repo_name || site.repo_name,
    default_branch || site.default_branch,
    ssg_type || site.ssg_type,
    JSON.stringify(dedupeSections(sections || JSON.parse(site.sections_json))),
    req.params.id
  );
  res.json(parseSite(db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id)));
});

// PATCH /api/sites/:id/sections/:slug/default-instruction
router.patch('/:id/sections/:slug/default-instruction', (req, res) => {
  const db = getDb();
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const sections = JSON.parse(site.sections_json).map(s =>
    s.slug === req.params.slug
      ? { ...s, defaultInstructionId: req.body.instructionId || null }
      : s
  );
  db.prepare('UPDATE sites SET sections_json=? WHERE id=?').run(JSON.stringify(sections), req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const changes = db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id).changes;
  if (!changes) return res.status(404).json({ error: 'Site not found' });
  res.json({ ok: true });
});

function dedupeSections(sections) {
  const seen = new Map();
  for (const s of sections) seen.set(s.slug, s);
  return [...seen.values()];
}

function parseSite(site) {
  return { ...site, sections: dedupeSections(JSON.parse(site.sections_json)) };
}

module.exports = router;
