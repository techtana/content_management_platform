const express = require('express');
const router = express.Router();
const { getDb } = require('../../config/db');
const ensureApiAuth = require('../../middleware/ensureApiAuth');

router.use(ensureApiAuth);

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const username = db.prepare("SELECT value FROM config WHERE key = 'github_username'").get()?.value;
    const avatar = db.prepare("SELECT value FROM config WHERE key = 'github_avatar'").get()?.value;
    const darkMode = db.prepare("SELECT value FROM config WHERE key = 'dark_mode'").get()?.value === '1';
    res.json({ username, avatar, darkMode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/', (req, res) => {
  try {
    const db = getDb();
    const { darkMode } = req.body;
    if (typeof darkMode === 'boolean') {
      db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('dark_mode', darkMode ? '1' : '0');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
