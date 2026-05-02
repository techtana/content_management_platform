const { getDb } = require('../config/db');

module.exports = function ensureSetup(req, res, next) {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM config WHERE key = 'github_token'").get();
    if (!row) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Setup not complete. Configure a GitHub token first.' });
      }
      return res.redirect('/setup');
    }
    next();
  } catch (err) {
    next(err);
  }
};
