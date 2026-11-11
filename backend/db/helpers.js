// Thin data-access layer over better-sqlite3.
//
// The design rule that keeps this small: SQL columns are named exactly like
// API fields, so a mapped row IS the JSON body. What's left is
//   * bools:   0/1  <-> true/false
//   * json:    TEXT <-> parsed values
//   * dates:   Date objects -> ISO strings on write; ISO strings pass through
//              on read (which is what Mongoose serialized to JSON anyway)
//   * _id:     generated UUID when the caller doesn't supply one
//   * stamps:  createdAt/updatedAt filled in (unless the table opts out)
//
// Complex queries (joins, LIKE, scope fragments) are hand-written SQL by the
// controllers; query()/queryOne() just apply the row mapping.

const crypto = require('crypto');
const { getDb } = require('./index');
const { TABLES } = require('./tables');
const { translateError } = require('./errors');

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

const meta = (table) => TABLES[table] || { bools: [], json: [] };

// ---------- row conversion ----------

function encodeValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function docToRow(table, doc) {
  const row = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value === undefined) continue;
    row[key] = encodeValue(value);
  }
  return row;
}

function mapRow(table, row) {
  if (!row) return row;
  const { bools, json } = meta(table);
  const doc = { ...row };
  for (const col of bools) {
    if (col in doc) doc[col] = doc[col] === 1 || doc[col] === true;
  }
  for (const col of json) {
    if (!(col in doc)) continue;
    const raw = doc[col];
    // NULL json column = mongoose path that was never set (e.g. attachment):
    // omit the key entirely instead of emitting null.
    if (raw == null) {
      delete doc[col];
      continue;
    }
    try {
      doc[col] = JSON.parse(raw);
    } catch (error) {
      // Leave the raw string rather than losing data on a corrupt cell.
    }
  }
  return doc;
}

// ---------- WHERE builder ----------

function buildWhere(where) {
  if (!where || Object.keys(where).length === 0) return { sql: '', params: [] };
  const clauses = [];
  const params = [];
  for (const [col, value] of Object.entries(where)) {
    if (value === undefined) {
      throw new Error(`buildWhere: undefined value for column "${col}"`);
    }
    if (value === null) {
      // Mongo {field: null} parity: match SQL NULL (our rows always write the
      // column, so IS NULL is the exact owner-partition semantics).
      clauses.push(`"${col}" IS NULL`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        clauses.push('0 = 1'); // IN () matches nothing, same as Mongo $in: []
        continue;
      }
      clauses.push(`"${col}" IN (${value.map(() => '?').join(', ')})`);
      params.push(...value.map(encodeValue));
    } else {
      clauses.push(`"${col}" = ?`);
      params.push(encodeValue(value));
    }
  }
  return { sql: `WHERE ${clauses.join(' AND ')}`, params };
}

// Bind params are encoded the same way as document fields, so hand-written
// SQL can pass Date/boolean values directly. Encoding is idempotent for
// values that buildWhere already converted.
function run(sql, params = []) {
  try {
    return getDb().prepare(sql).run(...params.map(encodeValue));
  } catch (error) {
    throw translateError(error);
  }
}

function get(sql, params = []) {
  try {
    return getDb().prepare(sql).get(...params.map(encodeValue));
  } catch (error) {
    throw translateError(error);
  }
}

function all(sql, params = []) {
  try {
    return getDb().prepare(sql).all(...params.map(encodeValue));
  } catch (error) {
    throw translateError(error);
  }
}

// SELECT helpers that apply mapRow for a known table.
function query(table, sql, params = []) {
  return all(sql, params).map((row) => mapRow(table, row));
}

function queryOne(table, sql, params = []) {
  return mapRow(table, get(sql, params));
}

// ---------- generic CRUD ----------

function insert(table, doc) {
  const { noUpdatedAt } = meta(table);
  const row = docToRow(table, doc);
  if (!row._id) row._id = newId();
  if (!row.createdAt) row.createdAt = nowIso();
  if (!noUpdatedAt && !row.updatedAt) row.updatedAt = nowIso();

  const cols = Object.keys(row);
  const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols
    .map(() => '?')
    .join(', ')})`;
  run(sql, cols.map((c) => row[c]));
  return findById(table, row._id);
}

function findById(table, id) {
  if (id === null || id === undefined) return null;
  return queryOne(table, `SELECT * FROM "${table}" WHERE "_id" = ?`, [id]);
}

function findOne(table, where) {
  const { sql, params } = buildWhere(where);
  return queryOne(table, `SELECT * FROM "${table}" ${sql} LIMIT 1`, params);
}

function find(table, where, options = {}) {
  const { sql, params } = buildWhere(where);
  let statement = `SELECT * FROM "${table}" ${sql}`;
  if (options.orderBy) statement += ` ORDER BY ${options.orderBy}`;
  if (options.limit) statement += ` LIMIT ${Number(options.limit)}`;
  return query(table, statement, params);
}

function count(table, where) {
  const { sql, params } = buildWhere(where);
  const row = get(`SELECT COUNT(*) AS n FROM "${table}" ${sql}`, params);
  return row ? row.n : 0;
}

function updateById(table, id, patch) {
  const { noUpdatedAt } = meta(table);
  const row = docToRow(table, patch);
  delete row._id;
  delete row.createdAt;

  if (!noUpdatedAt && !('updatedAt' in row)) row.updatedAt = nowIso();

  const cols = Object.keys(row);
  if (cols.length === 0) return findById(table, id);

  const sql = `UPDATE "${table}" SET ${cols.map((c) => `"${c}" = ?`).join(', ')} WHERE "_id" = ?`;
  const info = run(sql, [...cols.map((c) => row[c]), id]);
  if (info.changes === 0) return null;
  return findById(table, id);
}

function deleteById(table, id) {
  const info = run(`DELETE FROM "${table}" WHERE "_id" = ?`, [id]);
  return info.changes > 0;
}

function findByIdAndDelete(table, id) {
  const doc = findById(table, id);
  if (!doc) return null;
  deleteById(table, id);
  return doc;
}

function deleteWhere(table, where) {
  const { sql, params } = buildWhere(where);
  const info = run(`DELETE FROM "${table}" ${sql}`, params);
  return info.changes;
}

// findOne + act-by-_id, returning the matched doc (or null). Replicates the
// mongoose findOneAndUpdate / findOneAndDelete return contract used by the
// uniform {_id, ...scope} controller pattern.
function updateWhere(table, where, patch) {
  const doc = findOne(table, where);
  if (!doc) return null;
  return updateById(table, doc._id, patch);
}

function findAndDelete(table, where) {
  const doc = findOne(table, where);
  if (!doc) return null;
  deleteById(table, doc._id);
  return doc;
}

// Multi-statement atomicity: better-sqlite3 is synchronous, so this is a
// real transaction (and nests as a savepoint). Replaces the non-atomic
// multi-document writes the Mongo code always had.
function tx(fn) {
  return getDb().transaction(fn)();
}

module.exports = {
  newId,
  nowIso,
  encodeValue,
  docToRow,
  mapRow,
  buildWhere,
  run,
  get,
  all,
  query,
  queryOne,
  insert,
  findById,
  findOne,
  find,
  count,
  updateById,
  deleteById,
  findByIdAndDelete,
  deleteWhere,
  updateWhere,
  findAndDelete,
  tx,
};
