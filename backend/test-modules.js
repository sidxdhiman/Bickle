/* Scoping + owner CRUD regression across all modules: owner flows unchanged,
   guest reads empty per module, guest writes isolated, purge on revoke.
   Run with `npm test`. */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const mongoose = require('mongoose');

const BASE = 'http://127.0.0.1:5098/api';

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

const ALL_PAGES = ['tasks', 'habits', 'focus', 'calendar', 'notes', 'whiteboard', 'pdf-editor', 'sleep', 'money', 'translator', 'art'];

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const server = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, MONGODB_URI: uri, PORT: '5098', JWT_SECRET: 'test-secret', NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server start timeout')), 40000);
      server.stdout.on('data', (d) => {
        if (d.toString().includes('Server running')) { clearTimeout(timer); resolve(); }
      });
      server.stderr.on('data', (d) => process.stderr.write(`[srv-err] ${d}`));
    });

    const reg = await api('POST', '/auth/register', { body: { username: 'owner', email: 'owner@test.dev', password: 'secret123' } });
    const ownerToken = reg.data.token;

    // Owner creates one item per module
    const list = await api('POST', '/lists', { token: ownerToken, body: { name: 'My List' } });
    check(list.status === 201, 'owner: create list', list.data);
    const task = await api('POST', '/tasks', { token: ownerToken, body: { title: 'My Task', list: list.data._id } });
    check(task.status === 201, 'owner: create task', task.data);
    const habit = await api('POST', '/habits', { token: ownerToken, body: { name: 'My Habit' } });
    check(habit.status === 201, 'owner: create habit', habit.data);
    const event = await api('POST', '/calendar', { token: ownerToken, body: { title: 'My Event', start: '2026-01-01T10:00:00Z', end: '2026-01-01T11:00:00Z' } });
    check(event.status === 201, 'owner: create calendar event', event.data);
    const sleep = await api('POST', '/sleep', { token: ownerToken, body: { date: '2026-01-01', sleepStart: '2026-01-01T22:00:00Z', sleepEnd: '2026-01-02T06:00:00Z', quality: 'good' } });
    check(sleep.status === 201, 'owner: create sleep record', sleep.data);
    const tx = await api('POST', '/money/transactions', { token: ownerToken, body: { type: 'expense', amount: 10, category: 'Food' } });
    check(tx.status === 201, 'owner: create transaction', tx.data);
    const wb = await api('POST', '/whiteboards', { token: ownerToken, body: { title: 'My Board' } });
    check(wb.status === 201, 'owner: create whiteboard', wb.data);
    const blog = await api('POST', '/art/blogs', { token: ownerToken, body: { title: 'My Post', content: 'hello' } });
    check(blog.status === 201, 'owner: create art blog', blog.data);

    // Owner reads everything back
    const reads = [
      ['/lists', 1, 'lists'], ['/tasks', 1, 'tasks'], ['/habits', 1, 'habits'],
      ['/calendar', 1, 'calendar'], ['/sleep', 1, 'sleep'], ['/whiteboards', 1, 'whiteboards'],
      ['/art/blogs', 1, 'art blogs'], ['/art/photos', 0, 'art photos'],
    ];
    for (const [url, count, label] of reads) {
      const r = await api('GET', url, { token: ownerToken });
      check(r.status === 200 && r.data.length === count, `owner reads ${label} (${count})`, r.data && r.data.length);
    }
    const now = new Date();
    const monthQuery = `year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
    const mt = await api('GET', `/money/transactions?${monthQuery}`, { token: ownerToken });
    check(mt.status === 200 && mt.data.transactions.length === 1, 'owner reads money transactions (1)', mt.data && mt.data.transactions.length);
    const mcats = await api('POST', '/money/categories/init', { token: ownerToken, body: {} });
    check(mcats.status === 201 || mcats.status === 200, 'owner initializes default money categories', mcats.data);
    const mcatList = await api('GET', '/money/categories', { token: ownerToken });
    check(mcatList.status === 200 && mcatList.data.categories.length > 0, 'owner reads money categories', mcatList.data);

    // Public art showcase (no token) still sees owner's work
    const pub = await api('GET', '/art/blogs');
    check(pub.status === 200 && pub.data.length === 1, 'anonymous showcase sees owner art blogs', pub.data && pub.data.length);

    // Guest with ALL pages: every module read must be EMPTY
    const gs = await api('POST', '/guest', { token: ownerToken, body: { label: 'All', durationMinutes: 30, allowedPages: ALL_PAGES } });
    check(gs.status === 201, 'guest session created (all pages)', gs.data);
    const guestToken = gs.data.token;

    const emptyReads = [
      ['/lists', 'lists'], ['/tasks', 'tasks'], ['/habits', 'habits'],
      ['/calendar', 'calendar'], ['/sleep', 'sleep'], ['/whiteboards', 'whiteboards'],
      ['/art/blogs', 'art blogs'], ['/art/photos', 'art photos'],
    ];
    for (const [url, label] of emptyReads) {
      const r = await api('GET', url, { token: guestToken });
      check(r.status === 200 && r.data.length === 0, `GUEST sees empty ${label}`, r.data && r.data.length);
    }
    const gmt = await api('GET', `/money/transactions?${monthQuery}`, { token: guestToken });
    check(gmt.status === 200 && gmt.data.transactions.length === 0, 'GUEST sees empty money transactions', gmt.data && gmt.data.transactions.length);
    const gmcats = await api('GET', '/money/categories', { token: guestToken });
    check(gmcats.status === 200 && gmcats.data.categories.length === 0, 'GUEST sees empty money categories', gmcats.data && gmcats.data.categories.length);

    // Guest writes across modules land only in its partition
    const gt = await api('POST', '/tasks', { token: guestToken, body: { title: 'Guest Task', list: list.data._id } });
    check(gt.status === 201, 'guest: create task', gt.data);
    const gh = await api('POST', '/habits', { token: guestToken, body: { name: 'Guest Habit' } });
    check(gh.status === 201, 'guest: create habit', gh.data);
    const ginit = await api('POST', '/money/categories/init', { token: guestToken, body: {} });
    check(ginit.status === 201, 'guest: initialize own default money categories', ginit.data);

    const gtReads = await api('GET', '/tasks', { token: guestToken });
    check(gtReads.data.length === 1 && gtReads.data[0].title === 'Guest Task', 'guest reads only its own task', gtReads.data && gtReads.data.map((x) => x.title));

    // Owner still sees only its own data
    const otReads = await api('GET', '/tasks', { token: ownerToken });
    check(otReads.data.length === 1 && otReads.data[0].title === 'My Task', 'owner unaffected by guest task', otReads.data && otReads.data.map((x) => x.title));
    const ohReads = await api('GET', '/habits', { token: ownerToken });
    check(ohReads.data.length === 1 && ohReads.data[0].name === 'My Habit', 'owner unaffected by guest habit', ohReads.data && ohReads.data.map((x) => x.name));
    const omReads = await api('GET', '/money/categories', { token: ownerToken });
    check(omReads.data.categories.length === mcatList.data.categories.length, 'owner money categories unchanged by guest init', omReads.data && omReads.data.categories.length);

    // Owner cross-partition delete isolation: owner deleting task id does not touch guest's
    const del = await api('DELETE', `/tasks/${gt.data._id}`, { token: ownerToken });
    check(del.status === 404, 'owner cannot delete guest-partition task (404)', del.data);
    const gStill = await api('GET', '/tasks', { token: guestToken });
    check(gStill.data.length === 1, 'guest task survives owner delete attempt', gStill.data && gStill.data.length);

    // Revoke from owner side → guest token dies
    const revoke = await api('DELETE', `/guest/${gs.data._id}`, { token: ownerToken });
    check(revoke.status === 200, 'owner revoked session', revoke.data);
    const dead = await api('GET', '/tasks', { token: guestToken });
    check(dead.status === 401, 'guest token rejected after revoke', dead.data);

    await mongoose.connect(uri);
    const Task = require('./models/Task');
    const Habit = require('./models/Habit');
    const UserCategory = require('./models/UserCategory');
    const guestTasks = await Task.countDocuments({ guestSession: { $ne: null } });
    const guestHabits = await Habit.countDocuments({ guestSession: { $ne: null } });
    const guestCats = await UserCategory.countDocuments({ guestSession: { $ne: null } });
    const ownerTasks = await Task.countDocuments({ guestSession: null });
    const ownerHabits = await Habit.countDocuments({ guestSession: null });
    check(guestTasks === 0 && guestHabits === 0 && guestCats === 0, `guest data PURGED on revoke (tasks=${guestTasks}, habits=${guestHabits}, cats=${guestCats})`);
    check(ownerTasks === 1 && ownerHabits === 1, `owner data intact after revoke (tasks=${ownerTasks}, habits=${ownerHabits})`);
    await mongoose.disconnect();
  } catch (error) {
    failures += 1;
    console.error('ERROR:', error);
  } finally {
    server.kill();
    await mongod.stop();
  }

  console.log(failures === 0 ? 'ALL MODULE TESTS PASSED' : `${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
