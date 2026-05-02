const { getDb } = require('../config/db');

module.exports = function ensureApiAuth(req, res, next) {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM config WHERE key = 'github_token'").get();
    if (!row) {
      return res.status(401).json({ error: 'Unauthorized. GitHub token not configured.' });
    }
    next();
  } catch (err) {
    next(err);
  }
};
