// SQLite connection lifecycle. One process-wide connection (better-sqlite3
// is synchronous; Express handlers share it safely, WAL covers the rare
// second process such as the test harness).

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let db = null;

function openDatabase(filePath) {
  if (db) return db;

  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  db = new Database(filePath);
  // WAL lets the test process read the file while the server writes;
  // busy_timeout absorbs the transient locks that come with it.
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  // schema.sql is all CREATE IF NOT EXISTS — running it every boot is the
  // migration mechanism (add a table/column there, it appears on restart).
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not opened — call openDatabase() first');
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { openDatabase, getDb, closeDatabase };
