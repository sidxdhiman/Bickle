/* Two-profile isolation + chat tests: each profile (me / D) sees only its own
   data across modules, cross-profile reads/writes are rejected, the public
   showcase publishes only the showcase profile's art, chat is exchanged
   between the profiles and blocked for guests. Run with `npm test`. */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const { Message } = require('./models/Chat');

const BASE = 'http://127.0.0.1:5097/api';
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
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  // The test process shares the memory database so it can backdate expiry
  // fields and assert the server's purge behaviour.
  await mongoose.connect(uri);
  const server = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, MONGODB_URI: uri, PORT: '5097', JWT_SECRET: 'test-secret', NODE_ENV: 'development' },
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

    // --- Profile picker + logins ---
    const profiles = await api('GET', '/auth/profiles');
    check(profiles.status === 200 && profiles.data.length === 2, 'public profile list has both profiles', profiles.data);
    check(profiles.data.every((p) => !('email' in p)), 'profile list never exposes emails', profiles.data);

    const wrong = await api('POST', '/auth/login', { body: { profile: 'd', password: 'nope' } });
    check(wrong.status === 401, 'wrong password rejected', wrong.data);

    const meLogin = await api('POST', '/auth/login', { body: { profile: 'me', password: SEED_PASSWORD } });
    check(meLogin.status === 200, 'me profile logs in', meLogin.data && meLogin.data.message);
    const dLogin = await api('POST', '/auth/login', { body: { profile: 'd', password: SEED_PASSWORD } });
    check(dLogin.status === 200, 'D profile logs in', dLogin.data && dLogin.data.message);
    const meToken = meLogin.data.token;
    const dToken = dLogin.data.token;
    check(meLogin.data._id !== dLogin.data._id, 'profiles are distinct accounts');
    check(meLogin.data.showcase === true && dLogin.data.showcase === false, 'only the me profile is the showcase profile');

    // --- Notes: each profile sees only its own ---
    const meNote = await api('POST', '/notes', { token: meToken, body: { title: 'Note From Me', content: 'private' } });
    check(meNote.status === 201, 'me created a note', meNote.data);
    const dNote = await api('POST', '/notes', { token: dToken, body: { title: 'Note From D', content: 'also private' } });
    check(dNote.status === 201, 'D created a note', dNote.data);

    const meNotes = await api('GET', '/notes', { token: meToken });
    check(meNotes.data.length === 1 && meNotes.data[0].title === 'Note From Me', 'me sees ONLY my note', meNotes.data && meNotes.data.map((n) => n.title));
    const dNotes = await api('GET', '/notes', { token: dToken });
    check(dNotes.data.length === 1 && dNotes.data[0].title === 'Note From D', 'D sees ONLY her note', dNotes.data && dNotes.data.map((n) => n.title));

    // --- Cross-profile write attempts are rejected ---
    const dEditsMeNote = await api('PUT', `/notes/${meNote.data._id}`, { token: dToken, body: { title: 'Hijacked' } });
    check(dEditsMeNote.status === 404, 'D cannot edit my note (404)', dEditsMeNote.data);
    const dDeletesMeNote = await api('DELETE', `/notes/${meNote.data._id}`, { token: dToken });
    check(dDeletesMeNote.status === 404, 'D cannot delete my note (404)', dDeletesMeNote.data);
    const meNoteIntact = await api('GET', '/notes', { token: meToken });
    check(meNoteIntact.data[0].title === 'Note From Me', 'my note survives D\'s attempts', meNoteIntact.data && meNoteIntact.data.map((n) => n.title));

    // --- Tasks + habits partitioning ---
    const meList = await api('POST', '/lists', { token: meToken, body: { name: 'My List' } });
    const meTask = await api('POST', '/tasks', { token: meToken, body: { title: 'Task Of Mine', list: meList.data._id } });
    const dHabit = await api('POST', '/habits', { token: dToken, body: { name: 'Habit Of D' } });
    check(meTask.status === 201 && dHabit.status === 201, 'profiles created task + habit', { task: meTask.status, habit: dHabit.status });

    const dTasks = await api('GET', '/tasks', { token: dToken });
    check(dTasks.status === 200 && dTasks.data.length === 0, 'D sees none of my tasks', dTasks.data);
    const meHabits = await api('GET', '/habits', { token: meToken });
    check(meHabits.status === 200 && meHabits.data.length === 0, 'me sees none of D\'s habits', meHabits.data);
    const dDeletesMyTask = await api('DELETE', `/tasks/${meTask.data._id}`, { token: dToken });
    check(dDeletesMyTask.status === 404, 'D cannot delete my task (404)', dDeletesMyTask.data);

    // --- Art partitioning + public showcase ---
    const meArt = await api('POST', '/art/blogs', { token: meToken, body: { title: 'My Art', content: 'x' } });
    const dArt = await api('POST', '/art/blogs', { token: dToken, body: { title: 'D Art', content: 'y' } });
    check(meArt.status === 201 && dArt.status === 201, 'profiles created art blogs', { me: meArt.status, d: dArt.status });

    const meArtList = await api('GET', '/art/blogs', { token: meToken });
    check(meArtList.data.length === 1 && meArtList.data[0].title === 'My Art', 'me sees only my art', meArtList.data && meArtList.data.map((b) => b.title));
    const dArtList = await api('GET', '/art/blogs', { token: dToken });
    check(dArtList.data.length === 1 && dArtList.data[0].title === 'D Art', 'D sees only her art', dArtList.data && dArtList.data.map((b) => b.title));
    const anonArt = await api('GET', '/art/blogs');
    check(anonArt.data.some((b) => b.title === 'My Art'), 'public showcase shows showcase-profile art', anonArt.data && anonArt.data.map((b) => b.title));
    check(anonArt.data.every((b) => b.title !== 'D Art'), 'public showcase HIDES D\'s art', anonArt.data && anonArt.data.map((b) => b.title));
    const dDeletesMyArt = await api('DELETE', `/art/blogs/${meArt.data._id}`, { token: dToken });
    check(dDeletesMyArt.status === 404, 'D cannot delete my art (404)', dDeletesMyArt.data);

    // --- Avatar/profile updates stay per profile ---
    const meAvatar = await api('PUT', '/auth/me', { token: meToken, body: { avatar: 'data:image/png;base64,AAAA' } });
    check(meAvatar.status === 200 && meAvatar.data.avatar === 'data:image/png;base64,AAAA', 'me saved an avatar', meAvatar.data && meAvatar.data.avatar);
    const dMe = await api('GET', '/auth/me', { token: dToken });
    check(!dMe.data.avatar, 'D does not see my avatar', dMe.data && dMe.data.avatar);

    // --- Chat between the two profiles ---
    const meConvos = await api('GET', '/chat', { token: meToken });
    check(meConvos.status === 200 && meConvos.data.length === 1, 'me has one conversation', meConvos.data && meConvos.data.length);
    check(meConvos.data[0].peer.username === 'D', 'my conversation peer is D', meConvos.data[0] && meConvos.data[0].peer);
    const dConvos = await api('GET', '/chat', { token: dToken });
    check(dConvos.status === 200 && dConvos.data[0].peer.username === 'Sidharth', 'D conversation peer is me', dConvos.data[0] && dConvos.data[0].peer);
    check(String(meConvos.data[0]._id) === String(dConvos.data[0]._id), 'both profiles share the same conversation id');

    const convId = meConvos.data[0]._id;
    const sent = await api('POST', `/chat/${convId}/messages`, { token: meToken, body: { text: 'Hi D' } });
    check(sent.status === 201 && sent.data.text === 'Hi D', 'me sent a chat message', sent.data);

    const dMsgs = await api('GET', `/chat/${convId}/messages`, { token: dToken });
    check(dMsgs.status === 200 && dMsgs.data.length === 1 && dMsgs.data[0].text === 'Hi D', 'D received my message', dMsgs.data && dMsgs.data.map((m) => m.text));
    const dUnread = await api('GET', '/chat/unread-count', { token: dToken });
    check(dUnread.data.count === 1, 'D has 1 unread message', dUnread.data);
    const meUnread = await api('GET', '/chat/unread-count', { token: meToken });
    check(meUnread.data.count === 0, 'I have no unread from myself', meUnread.data);

    const reply = await api('POST', `/chat/${convId}/messages`, { token: dToken, body: { text: 'Hey!' } });
    check(reply.status === 201, 'D replied', reply.data);
    const cursor = sent.data.createdAt;
    const polled = await api('GET', `/chat/${convId}/messages?after=${encodeURIComponent(cursor)}`, { token: meToken });
    check(polled.status === 200 && polled.data.some((m) => m.text === 'Hey!'), 'polling with ?after returns the new reply', polled.data && polled.data.map((m) => m.text));

    const dRead = await api('POST', `/chat/${convId}/read`, { token: dToken, body: {} });
    check(dRead.status === 200, 'D marked the conversation read', dRead.data);
    const dUnreadAfter = await api('GET', '/chat/unread-count', { token: dToken });
    check(dUnreadAfter.data.count === 0, 'D unread count back to 0', dUnreadAfter.data);

    // --- Third accounts cannot reach the conversation ---
    const stranger = await api('POST', '/auth/register', { body: { username: 'stranger', email: 'stranger@test.dev', password: 'secret123' } });
    check(stranger.status === 201, 'third account registered', stranger.data);
    const strangerRead = await api('GET', `/chat/${convId}/messages`, { token: stranger.data.token });
    check(strangerRead.status === 404, 'non-participant cannot read the conversation', strangerRead.data);
    const strangerSend = await api('POST', `/chat/${convId}/messages`, { token: stranger.data.token, body: { text: 'intruder' } });
    check(strangerSend.status === 404, 'non-participant cannot post to the conversation', strangerSend.data);

    // --- Guests are blocked from chat entirely ---
    const gs = await api('POST', '/guest', { token: meToken, body: { label: 'Watcher', durationMinutes: 5, allowedPages: ['notes'] } });
    check(gs.status === 201, 'guest session created', gs.data);
    const guestChat = await api('GET', '/chat', { token: gs.data.token });
    check(guestChat.status === 403, 'guest blocked from /chat', guestChat.data);
    const guestUnread = await api('GET', '/chat/unread-count', { token: gs.data.token });
    check(guestUnread.status === 403, 'guest blocked from /chat/unread-count', guestUnread.data);
    const guestSettings = await api('PUT', `/chat/${convId}/settings`, { token: gs.data.token, body: { mode: 'off' } });
    check(guestSettings.status === 403, 'guest cannot change chat settings', guestSettings.data);
    await api('DELETE', `/guest/${gs.data._id}`, { token: meToken });

    // --- Chat settings, disappearing messages and attachments ---
    const meConvos2 = await api('GET', '/chat', { token: meToken });
    check(
      meConvos2.status === 200 && meConvos2.data.length === 1 && meConvos2.data[0].peer.username === 'D',
      'the registered stranger never appears as a chat contact',
      meConvos2.data && meConvos2.data.map((c) => c.peer.username)
    );

    // Either profile may change the disappearing policy; it posts a notice.
    const setMode = await api('PUT', `/chat/${convId}/settings`, { token: dToken, body: { mode: '24h' } });
    check(setMode.status === 200 && setMode.data.mode === '24h', 'D changed the chat settings', setMode.data && setMode.data.mode);
    check(
      setMode.data.message && setMode.data.message.type === 'system' && /changed the settings to 24 hours/.test(setMode.data.message.text),
      'settings change posted a system message',
      setMode.data.message
    );
    const badMode = await api('PUT', `/chat/${convId}/settings`, { token: meToken, body: { mode: 'forever' } });
    check(badMode.status === 400, 'invalid disappearing mode rejected', badMode.data);
    const modeListed = await api('GET', '/chat', { token: meToken });
    check(modeListed.data[0].disappearMode === '24h', 'conversation list exposes the active mode', modeListed.data[0]);

    // Messages sent under a timed policy snapshot their absolute expiry...
    const timed = await api('POST', `/chat/${convId}/messages`, { token: meToken, body: { text: 'expires soon' } });
    check(
      timed.status === 201 && timed.data.disappear === '24h' && !!timed.data.expiresAt,
      'timed message stamped with an expiry',
      { disappear: timed.data.disappear, expiresAt: timed.data.expiresAt }
    );

    // ...and vanish from reads once it passes (backdate to simulate the wait).
    await Message.updateOne({ _id: timed.data._id }, { expiresAt: new Date(Date.now() - 1000) });
    const afterPurge = await api('GET', `/chat/${convId}/messages`, { token: meToken });
    check(
      afterPurge.data.every((m) => m.text !== 'expires soon'),
      'expired message purged from reads',
      afterPurge.data.map((m) => m.text)
    );

    // 'viewed': stays while the reader is in the chat, deleted when they leave.
    const setViewed = await api('PUT', `/chat/${convId}/settings`, { token: meToken, body: { mode: 'viewed' } });
    check(setViewed.status === 200 && setViewed.data.mode === 'viewed', 'me switched the chat to after-viewing', setViewed.data && setViewed.data.mode);
    const vanish = await api('POST', `/chat/${convId}/messages`, { token: meToken, body: { text: 'seen once' } });
    check(vanish.data.disappear === 'viewed' && !vanish.data.expiresAt, 'viewed message has no timer before it is read', vanish.data.disappear);
    await api('POST', `/chat/${convId}/read`, { token: dToken, body: {} });
    const stillThere = await api('GET', `/chat/${convId}/messages`, { token: meToken });
    check(stillThere.data.some((m) => m.text === 'seen once'), 'viewed message stays while the reader is still in the chat', stillThere.data.map((m) => m.text));
    const leaveD = await api('POST', `/chat/${convId}/leave`, { token: dToken, body: {} });
    check(leaveD.status === 200 && leaveD.data.ok, 'the reader can leave the conversation', leaveD.data);
    const goneViewed = await api('GET', `/chat/${convId}/messages`, { token: meToken });
    check(goneViewed.data.every((m) => m.text !== 'seen once'), 'viewed message deleted once the reader leaves', goneViewed.data.map((m) => m.text));

    // Unread 'viewed' messages survive the reader's leave; own ones are only
    // deleted once the other side (the reader) leaves.
    await api('POST', `/chat/${convId}/messages`, { token: meToken, body: { text: 'not yet seen' } });
    await api('POST', `/chat/${convId}/leave`, { token: dToken, body: {} });
    const afterReaderLeave = await api('GET', `/chat/${convId}/messages`, { token: meToken });
    check(
      afterReaderLeave.data.some((m) => m.text === 'not yet seen'),
      'unread viewed message survives a leave',
      afterReaderLeave.data.map((m) => m.text)
    );

    // D reads both, then I leave: my own viewed message must stay put...
    const mineSent = await api('POST', `/chat/${convId}/messages`, { token: meToken, body: { text: 'mine, read by D' } });
    check(mineSent.status === 201, 'own message sent for the leave checks', mineSent.data && mineSent.data.text);
    await api('POST', `/chat/${convId}/read`, { token: dToken, body: {} });
    await api('POST', `/chat/${convId}/leave`, { token: meToken, body: {} });
    const afterMyLeave = await api('GET', `/chat/${convId}/messages`, { token: meToken });
    check(
      afterMyLeave.data.some((m) => m.text === 'mine, read by D'),
      'own viewed message waits for the other side to leave',
      afterMyLeave.data.map((m) => m.text)
    );

    // ...and is deleted the moment D (the reader) leaves.
    await api('POST', `/chat/${convId}/leave`, { token: dToken, body: {} });
    const afterGone = await api('GET', `/chat/${convId}/messages`, { token: meToken });
    check(
      afterGone.data.every((m) => m.text !== 'mine, read by D'),
      'own viewed message deleted when the reader leaves',
      afterGone.data.map((m) => m.text)
    );

    // File attachments round-trip; dangerous types are rejected.
    const fileForm = new FormData();
    fileForm.append('text', 'here is a file');
    fileForm.append('file', new Blob(['hello chat'], { type: 'text/plain' }), 'note.txt');
    const uploadRes = await fetch(`${BASE}/chat/${convId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${meToken}` },
      body: fileForm,
    });
    let uploadData = null;
    try { uploadData = await uploadRes.json(); } catch { /* no body */ }
    check(
      uploadRes.status === 201 && uploadData.attachment && uploadData.attachment.url && uploadData.attachment.kind === 'file',
      'file attachment uploaded and stored on the message',
      uploadData && uploadData.attachment
    );
    if (uploadData && uploadData.attachment) {
      const served = await fetch(`http://127.0.0.1:5097${uploadData.attachment.url}`);
      check(served.status === 200, 'attachment is served from /uploads', served.status);
    }
    const htmlForm = new FormData();
    htmlForm.append('file', new Blob(['<html></html>'], { type: 'text/html' }), 'evil.html');
    const htmlUpload = await fetch(`${BASE}/chat/${convId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${meToken}` },
      body: htmlForm,
    });
    check(htmlUpload.status === 400, 'html attachment rejected', htmlUpload.status);

    // Unread responses carry the newest message so the in-app popup can
    // render a preview without fetching the whole thread.
    await api('POST', `/chat/${convId}/messages`, { token: dToken, body: { text: 'ping for toast' } });
    const latestCheck = await api('GET', '/chat/unread-count', { token: meToken });
    check(
      latestCheck.data.count >= 1 && latestCheck.data.latest && latestCheck.data.latest.sender === 'D' && latestCheck.data.latest.preview === 'ping for toast',
      'unread response carries the latest message for toasts',
      latestCheck.data
    );

    // Non-participants cannot touch the settings either.
    const strangerSettings = await api('PUT', `/chat/${convId}/settings`, { token: stranger.data.token, body: { mode: 'off' } });
    check(strangerSettings.status === 404, 'stranger cannot change chat settings', strangerSettings.data);

    // --- D deletes her data: mine must be untouched ---
    const del = await api('DELETE', '/settings/delete-all-data', { token: dToken });
    check(del.status === 200, 'D deleted all of her data', del.data);
    const dNotesAfter = await api('GET', '/notes', { token: dToken });
    check(dNotesAfter.data.length === 0, 'D data is gone for D', dNotesAfter.data);
    const meNotesAfter = await api('GET', '/notes', { token: meToken });
    check(meNotesAfter.data.length === 1 && meNotesAfter.data[0].title === 'Note From Me', 'my notes untouched by D\'s delete-all', meNotesAfter.data && meNotesAfter.data.map((n) => n.title));
    const meHabitsAfter = await api('GET', '/habits', { token: meToken });
    check(meHabitsAfter.data.length === 0, 'baseline: I never had habits', meHabitsAfter.data);
    const dArtAfter = await api('GET', '/art/blogs', { token: dToken });
    check(dArtAfter.data.length === 1, 'settings delete-all only wipes listed modules (art stays for D)', dArtAfter.data && dArtAfter.data.length);
  } catch (error) {
    failures += 1;
    console.error('ERROR:', error);
  } finally {
    server.kill();
    await mongoose.disconnect();
    await mongod.stop();
  }

  console.log(failures === 0 ? 'ALL TWO-PROFILE TESTS PASSED' : `${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
