// Phase 0 gate: proves the data layer's conversion rules end-to-end.
// Run with: npm run db:check

const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDatabase, closeDatabase } = require('./index');
const {
  newId,
  insert,
  findById,
  findOne,
  find,
  count,
  updateById,
  deleteById,
  tx,
  all,
  run,
} = require('./helpers');

const dbPath = path.join(os.tmpdir(), `bickle-roundtrip-${process.pid}.db`);
let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function expectThrow(label, fn, predicate) {
  try {
    fn();
    check(label, false, 'no error thrown');
  } catch (error) {
    check(label, predicate(error), `got: ${error.name} code=${error.code} ${error.message}`);
  }
}

function cleanup() {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(dbPath + suffix);
    } catch (error) {
      /* already gone */
    }
  }
}

try {
  cleanup();

  // 1. Schema is idempotent (runs on every boot by design).
  const db = openDatabase(dbPath);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  check('schema runs twice without error', true);

  // 2. Users: UUID _id, bool + json conversion, ISO timestamps.
  const user = insert('users', {
    username: 'alice',
    email: 'ALICE@example.com',
    password: 'hashed-not-really',
    showcase: true,
    preferences: { theme: 'light', notifications: false },
  });
  check('_id is a UUID', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(user._id), user._id);
  check('showcase reads back as boolean true', user.showcase === true, JSON.stringify(user.showcase));
  check('preferences round-trips as object',
    user.preferences && user.preferences.theme === 'light' && user.preferences.notifications === false,
    JSON.stringify(user.preferences));
  check('createdAt is ISO-8601', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(user.createdAt), user.createdAt);

  // 3. Duplicate unique column -> mongoose-compatible code 11000.
  // (Email case-normalization is the auth controllers' job in Phase 1 —
  // SQLite's UNIQUE is case-sensitive, unlike mongoose's lowercase setter.)
  expectThrow('duplicate email -> code 11000',
    () => insert('users', { username: 'bob', email: 'ALICE@example.com', password: 'x' }),
    (e) => e.code === 11000);

  // 4. Tasks: Date -> ISO on write, bool/json round-trip, null-partition WHERE.
  const list = insert('task_lists', { user: user._id, name: 'Inbox' });
  check('statuses default parses as empty array', Array.isArray(list.statuses) && list.statuses.length === 0,
    JSON.stringify(list.statuses));

  const due = new Date('2026-11-10T18:00:00.000Z');
  const task = insert('tasks', {
    user: user._id,
    guestSession: null,
    list: list._id,
    title: 'Ship SQLite',
    dueDate: due,
    isStarred: true,
    tags: ['db', 'migration'],
    priority: 'high',
  });
  check('Date written as ISO string', task.dueDate === due.toISOString(), task.dueDate);
  check('isStarred reads back as boolean true', task.isStarred === true, JSON.stringify(task.isStarred));
  check('tags round-trip as array', Array.isArray(task.tags) && task.tags[1] === 'migration', JSON.stringify(task.tags));

  const guestSessionId = newId();
  const guestTask = insert('tasks', {
    user: user._id,
    guestSession: guestSessionId,
    list: list._id,
    title: 'Guest copy',
  });

  const ownerRows = find('tasks', { user: user._id, guestSession: null });
  check('owner WHERE (guestSession null) returns only owner rows',
    ownerRows.length === 1 && ownerRows[0]._id === task._id, JSON.stringify(ownerRows.map((t) => t.title)));
  const guestRows = find('tasks', { user: user._id, guestSession: guestSessionId });
  check('guest WHERE returns only guest rows',
    guestRows.length === 1 && guestRows[0]._id === guestTask._id);
  check('count respects partition', count('tasks', { user: user._id }) === 2);

  // 5. Partial unique indexes reproduce Mongo null-as-value semantics.
  insert('categories', { user: user._id, name: 'Work' });
  expectThrow('duplicate owner category -> 11000',
    () => insert('categories', { user: user._id, name: 'Work' }),
    (e) => e.code === 11000);
  insert('categories', { user: user._id, guestSession: guestSessionId, name: 'Work' });
  check('same name allowed in a guest partition', true);
  expectThrow('duplicate guest category -> 11000',
    () => insert('categories', { user: user._id, guestSession: guestSessionId, name: 'Work' }),
    (e) => e.code === 11000);

  // 6. updateById: bool flip, explicit null clear, updatedAt stamp.
  const before = task.updatedAt;
  const updated = updateById('tasks', task._id, { isStarred: false, dueDate: null, status: 'done' });
  check('bool flips to false', updated.isStarred === false, JSON.stringify(updated.isStarred));
  check('explicit null clears dueDate', updated.dueDate === null, JSON.stringify(updated.dueDate));
  check('status updated', updated.status === 'done');
  check('updatedAt restamped', typeof updated.updatedAt === 'string' && updated.updatedAt >= before,
    `${before} -> ${updated.updatedAt}`);
  check('updateById returns null for missing id', updateById('tasks', 'nope', { title: 'x' }) === null);

  // 7. NULL json column is omitted on read (mongoose absent-path parity).
  const message = insert('messages', {
    conversationId: 'conv-1',
    sender: user._id,
    text: 'hello',
  });
  check('unset attachment key omitted from doc', !('attachment' in message), JSON.stringify(message.attachment));
  const withAttachment = insert('messages', {
    conversationId: 'conv-1',
    sender: user._id,
    attachment: { url: '/uploads/chat/x.png', name: 'x.png', kind: 'image', size: 10, mime: 'image/png' },
  });
  check('attachment parses as object',
    withAttachment.attachment && withAttachment.attachment.url === '/uploads/chat/x.png',
    JSON.stringify(withAttachment.attachment));

  // 8. Habit: no updatedAt column (mongoose schema has no timestamps).
  const habit = insert('habits', { userId: user._id, name: 'Read', completedDates: [new Date('2026-11-01T00:00:00Z')] });
  check('habit has createdAt but no updatedAt',
    typeof habit.createdAt === 'string' && !('updatedAt' in habit), Object.keys(habit).join(','));
  check('completedDates parse to ISO strings',
    Array.isArray(habit.completedDates) && habit.completedDates[0] === '2026-11-01T00:00:00.000Z',
    JSON.stringify(habit.completedDates));

  // 9. Transactions roll back on throw.
  const marker = 'tx-should-not-exist';
  try {
    tx(() => {
      insert('notes', { user: user._id, title: marker });
      throw new Error('boom');
    });
  } catch (error) {
    /* expected */
  }
  check('failed transaction rolls back', count('notes', { title: marker }) === 0);

  // 10. deleteById + guest row untouched by owner delete.
  check('deleteById removes owner task', deleteById('tasks', task._id) === true);
  check('guest copy survives owner delete', findById('tasks', guestTask._id) !== null);

  // 11. Direct SQL escape hatch works alongside helpers.
  const raw = all('SELECT "_id", "title" FROM "tasks" WHERE "user" = ?', [user._id]);
  check('raw query returns rows', raw.length === 1 && raw[0].title === 'Guest copy');
  run('UPDATE "tasks" SET "title" = ? WHERE "_id" = ?', ['Renamed', guestTask._id]);
  check('raw run mutates', findById('tasks', guestTask._id).title === 'Renamed');

  closeDatabase();
} catch (error) {
  failures += 1;
  console.error('UNEXPECTED ERROR:', error);
} finally {
  closeDatabase();
  cleanup();
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll round-trip checks passed.');
