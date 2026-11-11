/* Per-guest-session data isolation tests: empty reads for guests, partitioned
   writes, cross-partition delete protection, body-sanitization against
   repartitioning attacks, and purge on session end. Run with `npm test`. */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDatabase, closeDatabase } = require('./db');
const { get } = require('./db/helpers');

const BASE = 'http://127.0.0.1:5099/api';

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
  if (cond) {
    console.log(`ok   ${msg}`);
  } else {
    failures += 1;
    console.error(`FAIL ${msg}${extra !== undefined ? ' — ' + JSON.stringify(extra) : ''}`);
  }
};

(async () => {
  // Shared SQLite file: the server owns the writes, this process opens the
  // same file (WAL) for direct row assertions after the HTTP flows.
  const dbPath = path.join(os.tmpdir(), `bickle-test-isolation-${process.pid}.db`);
  const server = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, SQLITE_PATH: dbPath, PORT: '5099', JWT_SECRET: 'test-secret', NODE_ENV: 'development' },
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

    // --- Setup: owner with one note ---
    const reg = await api('POST', '/auth/register', { body: { username: 'owner', email: 'owner@test.dev', password: 'secret123' } });
    check(reg.status === 201, 'owner registered', reg.data);
    const ownerToken = reg.data.token;

    const note = await api('POST', '/notes', { token: ownerToken, body: { title: 'Owner Secret', content: 'mine' } });
    check(note.status === 201, 'owner created a note', note.data);

    const cat = await api('POST', '/notes/categories', { token: ownerToken, body: { name: 'Work' } });
    check(cat.status === 201 || cat.status === 200, 'owner created category Work', cat.data);

    // --- Guest session granted only "notes" ---
    const gs = await api('POST', '/guest', { token: ownerToken, body: { label: 'Tester', durationMinutes: 30, allowedPages: ['notes'] } });
    check(gs.status === 201, 'guest session created', gs.data);
    const guestToken = gs.data.token;

    const gn = await api('GET', '/notes', { token: guestToken });
    check(gn.status === 200 && Array.isArray(gn.data) && gn.data.length === 0, 'GUEST SEES EMPTY notes (no owner data)', gn.data);

    const gt = await api('GET', '/tasks', { token: guestToken });
    check(gt.status === 403, 'guest blocked from non-granted module (tasks)', gt.data);

    const st = await api('DELETE', '/settings/delete-all-data', { token: guestToken });
    check(st.status === 403, 'guest blocked from settings delete-all-data', st.data);

    const gcat = await api('GET', '/notes/categories', { token: guestToken });
    check(gcat.status === 200 && (!gcat.data.includes || !gcat.data.includes('Work')), 'guest categories do not include owner categories', gcat.data);

    // --- Guest writes into its own partition ---
    const gn2 = await api('POST', '/notes', { token: guestToken, body: { title: 'Guest Note', content: 'temp' } });
    check(gn2.status === 201, 'guest created a note', gn2.data);

    const gcat2 = await api('POST', '/notes/categories', { token: guestToken, body: { name: 'Work' } });
    check(gcat2.status === 201 || gcat2.status === 200, 'guest can create same-name category in own partition (no unique clash)', gcat2.data);

    // Hostile guest tries to move its note into the owner partition via crafted body
    const attack = await api('PUT', `/notes/${gn2.data._id}`, { token: guestToken, body: { title: 'Hijacked', guestSession: null, user: '000000000000000000000000' } });
    check(attack.status === 200, 'crafted update accepted but sanitized', attack.data);
    const attackOn = await api('GET', '/notes', { token: ownerToken });
    check(!attackOn.data.some((x) => x.title === 'Hijacked'), 'owner NEVER sees guest-repartitioned note', attackOn.data && attackOn.data.map((x) => x.title));

    // --- Owner unaffected ---
    const on = await api('GET', '/notes', { token: ownerToken });
    check(on.status === 200 && on.data.length === 1 && on.data[0].title === 'Owner Secret', 'OWNER SEES ONLY own note (guest note invisible)', on.data && on.data.map((x) => x.title));

    const gn3 = await api('GET', '/notes', { token: guestToken });
    check(gn3.status === 200 && gn3.data.length === 1 && gn3.data[0].title === 'Hijacked', 'guest sees its note (retitled by attack, still in own partition)', gn3.data && gn3.data.map((x) => x.title));

    // Owner deletes their note — guest partition must be untouched
    await api('DELETE', `/notes/${note.data._id}`, { token: ownerToken });
    const gn4 = await api('GET', '/notes', { token: guestToken });
    check(gn4.data.length === 1, 'guest note survives owner deleting own note', gn4.data && gn4.data.length);
    const note2 = await api('POST', '/notes', { token: ownerToken, body: { title: 'Owner Note 2', content: 'still mine' } });
    check(note2.status === 201, 'owner created a second note', note2.data);

    // --- End session → purge ---
    const end = await api('POST', `/guest/session/${encodeURIComponent(guestToken)}/end`);
    check(end.status === 200, 'guest ended session', end.data);

    const after = await api('GET', '/notes', { token: guestToken });
    check(after.status === 401, 'expired guest token rejected after end', after.data);

    const guestNotes = get('SELECT COUNT(*) AS c FROM "notes" WHERE "guestSession" IS NOT NULL').c;
    const guestCats = get('SELECT COUNT(*) AS c FROM "categories" WHERE "guestSession" IS NOT NULL').c;
    const ownerNotes = get('SELECT COUNT(*) AS c FROM "notes" WHERE "guestSession" IS NULL').c;
    check(guestNotes === 0, `guest notes PURGED on session end (found ${guestNotes})`);
    check(guestCats === 0, `guest categories PURGED on session end (found ${guestCats})`);
    check(ownerNotes === 1, `owner notes intact after purge (found ${ownerNotes})`);
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

  console.log(failures === 0 ? 'ALL ISOLATION TESTS PASSED' : `${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
