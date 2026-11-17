/* Settings export/import roundtrip: GET /settings/export dumps the caller's
   owner-partition rows as a bickle-export backup, POST /settings/import
   restores that backup into a brand-new account with fresh ids and remapped
   references, and the fingerprint guard rejects double imports while still
   letting a different account import the same shared file. Run with `npm test`. */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDatabase, closeDatabase } = require('./db');
const { insert, find, findOne } = require('./db/helpers');

const BASE = 'http://127.0.0.1:5096/api';
const SEED_PASSWORD = process.env.SEED_PASSWORD || '0]Hyisgh';

const api = async (method, url, { token, body } = {}) => {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
};

let failures = 0;
const check = (cond, msg, extra) => {
  if (cond) console.log(`ok   ${msg}`);
  else { failures += 1; console.error(`FAIL ${msg}${extra !== undefined ? ' — ' + JSON.stringify(extra) : ''}`); }
};

(async () => {
  const dbPath = path.join(os.tmpdir(), `bickle-test-export-${process.pid}.db`);
  const server = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, SQLITE_PATH: dbPath, PORT: '5096', JWT_SECRET: 'test-secret', NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server start timeout')), 40000);
      server.stdout.on('data', (d) => {
        process.stdout.write(`[srv] ${d}`);
        if (d.toString().includes('Server running')) { clearTimeout(timer); resolve(); }
      });
      server.stderr.on('data', (d) => process.stderr.write(`[srv-err] ${d}`));
    });

    openDatabase(dbPath);

    // --- Seed a body of everyday data for the me profile ---
    const meLogin = await api('POST', '/auth/login', { body: { profile: 'me', password: SEED_PASSWORD } });
    check(meLogin.status === 200, 'me profile logs in', meLogin.data && meLogin.data.message);
    const meId = meLogin.data._id;
    const meToken = meLogin.data.token;

    const list = insert('task_lists', {
      user: meId, guestSession: null, name: 'Import Source',
      statuses: [{ id: 'st1', name: 'Todo', color: '#6366f1' }],
    });
    const taskA = insert('tasks', { user: meId, guestSession: null, list: list._id, title: 'Pack boxes', priority: 'high' });
    const taskB = insert('tasks', { user: meId, guestSession: null, list: list._id, title: 'Move day', isStarred: true });
    insert('calendar_events', {
      user: meId, guestSession: null, title: 'Moving van',
      start: '2026-11-20T09:00:00.000Z', end: '2026-11-20T10:00:00.000Z', task: taskA._id,
    });
    insert('notes', { user: meId, guestSession: null, title: 'Moving checklist', content: 'Boxes, tape, keys', lastEdited: new Date().toISOString() });
    insert('categories', { user: meId, guestSession: null, name: 'General' });
    insert('habits', { userId: meId, guestSession: null, name: 'Drink water', completedDates: ['2026-11-01'] });
    insert('sleeps', { user: meId, guestSession: null, date: '2026-11-01', sleepStart: '23:00', sleepEnd: '07:00', duration: 480 });
    insert('user_categories', { userId: meId, guestSession: null, name: 'Food', type: 'expense', color: '#ef4444' });
    insert('transactions', { userId: meId, guestSession: null, type: 'expense', amount: 42.5, category: 'Food', date: '2026-11-01' });
    insert('whiteboards', { user: meId, guestSession: null, title: 'Floor plan', elements: [{ id: 'e1', type: 'rect' }], lastEdited: new Date().toISOString() });

    // --- Export ---
    const noAuth = await api('GET', '/settings/export');
    check(noAuth.status === 401, 'export requires a token', noAuth.data);

    const exported = await api('GET', '/settings/export', { token: meToken });
    check(exported.status === 200 && exported.data.kind === 'bickle-export', 'export returns a bickle-export backup', exported.data);
    const backup = exported.data;
    check(
      backup.data.taskLists.length === 1 && backup.data.tasks.length === 2
        && backup.data.calendarEvents.length === 1 && backup.data.notes.length === 1
        && backup.data.categories.length === 1 && backup.data.habits.length === 1
        && backup.data.sleeps.length === 1 && backup.data.transactions.length === 1
        && backup.data.userCategories.length === 1 && backup.data.whiteboards.length === 1,
      'export contains every seeded module', backup.data && Object.fromEntries(Object.entries(backup.data).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v]))
    );
    const allRows = Object.entries(backup.data).flatMap(([key, value]) => (Array.isArray(value) ? value.map((row) => ({ table: key, row })) : []));
    check(
      allRows.every(({ row }) => !('user' in row) && !('guestSession' in row) && !('userId' in row)),
      'exported rows carry no partition columns'
    );

    // --- A fresh signup imports the backup ---
    const recipient = await api('POST', '/auth/register', { body: { username: 'recipient', email: 'recipient@test.dev', password: 'secret123' } });
    check(recipient.status === 201 && recipient.data.restricted === true, 'recipient account registered (restricted)', recipient.data);
    const recipientId = recipient.data._id;
    const recipientToken = recipient.data.token;

    // Pre-existing category with the same name: import must skip it, not abort.
    insert('categories', { user: recipientId, guestSession: null, name: 'General' });

    const badBody = await api('POST', '/settings/import', { token: recipientToken, body: { hello: 'world' } });
    check(badBody.status === 400, 'non-backup payload rejected', badBody.data);

    const tooNew = await api('POST', '/settings/import', { token: recipientToken, body: { kind: 'bickle-export', version: 99, data: {} } });
    check(tooNew.status === 400, 'newer-version export rejected', tooNew.data);

    const imported = await api('POST', '/settings/import', { token: recipientToken, body: backup });
    check(imported.status === 200 && imported.data.total === 10, 'backup imports into the new account', imported.data);
    check(imported.data.imported.categories === 0, 'colliding note category is skipped', imported.data.imported);
    check(
      imported.data.imported.taskLists === 1 && imported.data.imported.tasks === 2
        && imported.data.imported.calendarEvents === 1 && imported.data.imported.notes === 1
        && imported.data.imported.habits === 1 && imported.data.imported.sleeps === 1
        && imported.data.imported.transactions === 1 && imported.data.imported.userCategories === 1
        && imported.data.imported.whiteboards === 1,
      'every other row imports', imported.data.imported
    );

    // --- Ids are fresh and references were remapped ---
    const newLists = find('task_lists', { user: recipientId, guestSession: null });
    const newTasks = find('tasks', { user: recipientId, guestSession: null });
    const newEvents = find('calendar_events', { user: recipientId, guestSession: null });
    check(newLists.length === 1 && newLists[0]._id !== list._id, 'imported list gets a fresh id', newLists);
    check(newTasks.length === 2 && newTasks.every((t) => t.list === newLists[0]._id), 'task.list remapped to the new list id', newTasks.map((t) => t.list));
    check(
      newEvents.length === 1 && newTasks.some((t) => t._id === newEvents[0].task),
      'calendar task link remapped to a new task id', { eventTask: newEvents[0] && newEvents[0].task, tasks: newTasks.map((t) => t._id) }
    );
    const recipientHabits = find('habits', { userId: recipientId, guestSession: null });
    check(recipientHabits.length === 1 && recipientHabits[0].completedDates.includes('2026-11-01'), 'habit JSON arrays survive the roundtrip', recipientHabits);
    const meTasks = find('tasks', { user: meId, guestSession: null });
    check(meTasks.length === 2, 'the source account data is untouched', meTasks.length);

    const prefs = findOne('users', { _id: recipientId }).preferences;
    check(Array.isArray(prefs.importFingerprints) && prefs.importFingerprints.length === 1, 'import fingerprint recorded', prefs);

    // --- Guards ---
    const again = await api('POST', '/settings/import', { token: recipientToken, body: backup });
    check(again.status === 400 && /already been imported/.test(again.data.message || ''), 'same account cannot import the same file twice', again.data);

    const noTokenImport = await api('POST', '/settings/import', { body: backup });
    check(noTokenImport.status === 401, 'import requires a token', noTokenImport.data);

    // A different account CAN import the same shared file.
    const sharer = await api('POST', '/auth/register', { body: { username: 'sharer', email: 'sharer@test.dev', password: 'secret123' } });
    check(sharer.status === 201, 'second recipient registered', sharer.data);
    const sharedImport = await api('POST', '/settings/import', { token: sharer.data.token, body: backup });
    check(sharedImport.status === 200 && sharedImport.data.total === 11, 'another account imports the same shared file', sharedImport.data);

    // The restricted signup can export its own imported data too.
    const recipientExport = await api('GET', '/settings/export', { token: recipientToken });
    check(
      recipientExport.status === 200 && recipientExport.data.data.taskLists.length === 1
        && recipientExport.data.data.tasks.length === 2 && recipientExport.data.data.categories.length === 1,
      'recipient can export its imported data', recipientExport.data && Object.keys(recipientExport.data.data)
    );
  } catch (error) {
    failures += 1;
    console.error('ERROR:', error);
  } finally {
    server.kill();
    await new Promise((resolve) => {
      server.once('exit', resolve);
      setTimeout(resolve, 3000);
    });
    closeDatabase();
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        fs.rmSync(dbPath + suffix);
      } catch (error) {
        // Already gone.
      }
    }
  }

  console.log(failures === 0 ? 'ALL EXPORT/IMPORT TESTS PASSED' : `${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
