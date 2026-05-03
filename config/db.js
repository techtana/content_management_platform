const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

const dataDir = process.env.CMS_DATA_DIR
  ? path.resolve(process.env.CMS_DATA_DIR)
  : path.join(os.homedir(), '.github-pages-cms');

const dbPath = path.join(dataDir, 'data.db');

let db;

function initDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  // Migrations for existing installs
  const siteCols = db.prepare('PRAGMA table_info(sites)').all().map(c => c.name);
  if (!siteCols.includes('site_type')) {
    db.prepare("ALTER TABLE sites ADD COLUMN site_type TEXT NOT NULL DEFAULT 'blog'").run();
  }

  console.log(`SQLite database at ${dbPath}`);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

module.exports = { initDb, getDb };
