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
  // migration mechanism (add a table there, it appears on restart). New
  // columns on existing tables need a guarded ALTER instead: CREATE IF
  // NOT EXISTS leaves an old table untouched.
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  applyColumnMigrations(db);

  return db;
}

// [table, column, DDL] triples for columns added after a table first shipped.
// Each is skipped when the column already exists, so it is safe every boot.
const COLUMN_MIGRATIONS = [
  ['users', 'restricted', 'ALTER TABLE "users" ADD COLUMN "restricted" INTEGER NOT NULL DEFAULT 0'],
];

function applyColumnMigrations(database) {
  for (const [table, column, ddl] of COLUMN_MIGRATIONS) {
    const columns = database.prepare(`PRAGMA table_info("${table}")`).all();
    if (!columns.some((info) => info.name === column)) {
      database.exec(ddl);
    }
  }
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
