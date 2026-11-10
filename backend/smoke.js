// Phase 2 smoke gate — boots the API on a throwaway SQLite file and exercises
// every core CRUD module (lists, tasks, habits, calendar, sleep, notes,
// money, whiteboards) end-to-end, including cross-user scope isolation.
//
//   npm run smoke        → exit 0 only when every check passes

process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-secret';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { startServer } = require('./server');
const { closeDatabase } = require('./db');

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    const extra = detail !== undefined ? ` — ${JSON.stringify(detail)}` : '';
    console.log(`  FAIL ${name}${extra}`);
  }
}

async function main() {
  const dbPath = path.join(os.tmpdir(), `bickle-smoke-${process.pid}-${Date.now()}.db`);
  const { server, port } = await startServer({ sqlitePath: dbPath, port: 0 });
  const base = `http://127.0.0.1:${port}/api`;

  const api = async (method, url, { token, body } = {}) => {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (error) {
      // Non-JSON response — leave data null.
    }
    return { status: res.status, data };
  };

  try {
    // ------------------------------------------------------------ auth ----
    console.log('\nauth');
    const stamp = `${Date.now()}`;
    const owner = await api('POST', '/auth/register', {
      body: { username: `owner${stamp}`, email: `owner${stamp}@smoke.test`, password: 'secret123' },
    });
    check('register owner', owner.status === 201 && !!owner.data.token, owner);
    const ownerToken = owner.data.token;

    const other = await api('POST', '/auth/register', {
      body: { username: `other${stamp}`, email: `other${stamp}@smoke.test`, password: 'secret123' },
    });
    check('register other user', other.status === 201 && !!other.data.token, other);
    const otherToken = other.data.token;

    // ----------------------------------------------------------- lists ----
    console.log('\nlists');
    const inboxRes = await api('POST', '/lists', { token: ownerToken, body: { name: 'Inbox' } });
    const inbox = inboxRes.data;
    check('create list injects default statuses',
      inboxRes.status === 201 && Array.isArray(inbox.statuses) && inbox.statuses.length === 3
        && inbox.statuses[0].id === 'todo' && inbox.statuses[0].color === '#64748b',
      inboxRes);

    const workRes = await api('POST', '/lists', {
      token: ownerToken, body: { name: 'Work', isFavorite: true },
    });
    check('create favorite list', workRes.status === 201 && workRes.data.isFavorite === true, workRes);

    const listsRes = await api('GET', '/lists', { token: ownerToken });
    check('get lists returns both, favorite first',
      listsRes.status === 200 && listsRes.data.length === 2 && listsRes.data[0].name === 'Work',
      listsRes.data && listsRes.data.map((l) => l.name));

    const renamed = await api('PUT', `/lists/${inbox._id}`, {
      token: ownerToken, body: { name: 'Inbox Renamed' },
    });
    check('update list', renamed.status === 200 && renamed.data.name === 'Inbox Renamed', renamed);

    const customStatuses = [{ id: 'a', label: 'A', color: '#ffffff' }];
    const statusRes = await api('PUT', `/lists/${inbox._id}/statuses`, {
      token: ownerToken, body: { statuses: customStatuses },
    });
    check('update list statuses',
      statusRes.status === 200 && statusRes.data.statuses.length === 1
        && statusRes.data.statuses[0].id === 'a',
      statusRes);

    const missingList = await api('PUT', '/lists/does-not-exist', {
      token: ownerToken, body: { name: 'nope' },
    });
    check('update missing list → 404', missingList.status === 404, missingList);

    // ---------------------------------------------------------- tasks ----
    console.log('\ntasks');
    const task1Res = await api('POST', '/tasks', {
      token: ownerToken,
      body: { list: inbox._id, title: 'No due date', dueDate: '', priority: 'high' },
    });
    const task1 = task1Res.data;
    check('create task with empty dueDate stores null',
      task1Res.status === 201 && task1.dueDate === null && task1.priority === 'high',
      task1Res);

    const task2Res = await api('POST', '/tasks', {
      token: ownerToken,
      body: { list: inbox._id, title: 'Dated task', dueDate: '2026-11-15' },
    });
    const task2 = task2Res.data;
    check('create task with dueDate',
      task2Res.status === 201 && String(task2Res.data.dueDate).startsWith('2026-11-15'),
      task2Res);

    const byList = await api('GET', `/tasks?listId=${inbox._id}`, { token: ownerToken });
    check('get tasks by listId', byList.status === 200 && byList.data.length === 2, byList.data);

    const statusFlip = await api('PUT', `/tasks/${task1._id}`, {
      token: ownerToken, body: { status: 'completed' },
    });
    check('update task status', statusFlip.status === 200 && statusFlip.data.status === 'completed', statusFlip);

    const clearDue = await api('PUT', `/tasks/${task2._id}`, {
      token: ownerToken, body: { dueDate: '' },
    });
    check('clear task dueDate', clearDue.status === 200 && clearDue.data.dueDate === null, clearDue);

    const deleteTask = await api('DELETE', `/tasks/${task1._id}`, { token: ownerToken });
    check('delete task', deleteTask.status === 200, deleteTask);

    const deleteTaskAgain = await api('DELETE', `/tasks/${task1._id}`, { token: ownerToken });
    check('delete task again → 404', deleteTaskAgain.status === 404, deleteTaskAgain);

    // --------------------------------------------------------- habits ----
    console.log('\nhabits');
    const waterRes = await api('POST', '/habits', { token: ownerToken, body: { name: 'Water' } });
    const water = waterRes.data;
    check('create habit with defaults',
      waterRes.status === 201 && water.streak === 0 && Array.isArray(water.completedDates)
        && water.completedDates.length === 0 && water.frequency === 'daily',
      waterRes);

    const runRes = await api('POST', '/habits', {
      token: ownerToken, body: { name: 'Run', frequency: 'weekly' },
    });
    check('create habit with frequency', runRes.status === 201 && runRes.data.frequency === 'weekly', runRes);

    const habitsRes = await api('GET', '/habits', { token: ownerToken });
    check('get habits', habitsRes.status === 200 && habitsRes.data.length === 2, habitsRes.data && habitsRes.data.length);

    const habitById = await api('GET', `/habits/${water._id}`, { token: ownerToken });
    check('get habit by id', habitById.status === 200 && habitById.data.name === 'Water', habitById);

    const habit404 = await api('GET', '/habits/nope', { token: ownerToken });
    check('get missing habit → 404', habit404.status === 404, habit404);

    const habitUpdate = await api('PUT', `/habits/${water._id}`, {
      token: ownerToken, body: { name: 'Water 2L' },
    });
    check('update habit', habitUpdate.status === 200 && habitUpdate.data.name === 'Water 2L', habitUpdate);

    const complete1 = await api('PUT', `/habits/${water._id}/complete`, { token: ownerToken });
    const completed = complete1.data;
    check('complete habit → streak 1, ISO dates',
      complete1.status === 200 && completed.streak === 1 && completed.completedDates.length === 1
        && typeof completed.completedDates[0] === 'string'
        && completed.completedDates[0].includes('T')
        && typeof completed.lastCompleted === 'string',
      complete1);

    const complete2 = await api('PUT', `/habits/${water._id}/complete`, { token: ownerToken });
    check('complete twice → 400', complete2.status === 400, complete2);

    const uncomplete1 = await api('PUT', `/habits/${water._id}/uncomplete`, { token: ownerToken });
    check('uncomplete habit → streak 0, cleared',
      uncomplete1.status === 200 && uncomplete1.data.streak === 0
        && uncomplete1.data.completedDates.length === 0
        && uncomplete1.data.lastCompleted === null,
      uncomplete1);

    const uncomplete2 = await api('PUT', `/habits/${water._id}/uncomplete`, { token: ownerToken });
    check('uncomplete twice → 400', uncomplete2.status === 404 || uncomplete2.status === 400, uncomplete2);

    const habitBadFreq = await api('POST', '/habits', {
      token: ownerToken, body: { name: 'Bad', frequency: 'hourly' },
    });
    check('invalid habit frequency → 500', habitBadFreq.status === 500, habitBadFreq);

    // ------------------------------------------------------- calendar ----
    console.log('\ncalendar');
    const eventRes = await api('POST', '/calendar', {
      token: ownerToken,
      body: {
        title: 'Dentist',
        start: '2026-11-20T10:00:00.000Z',
        end: '2026-11-20T11:00:00.000Z',
        recurrence: { frequency: 'none', interval: 1 },
      },
    });
    check('create event, frequency none → schema default',
      eventRes.status === 201 && eventRes.data.recurrence
        && eventRes.data.recurrence.frequency === 'none',
      eventRes);

    const recurringRes = await api('POST', '/calendar', {
      token: ownerToken,
      body: {
        title: 'Standup',
        start: '2026-11-21T09:00:00.000Z',
        end: '2026-11-21T09:30:00.000Z',
        recurrence: { frequency: 'daily', interval: 2 },
      },
    });
    check('create recurring event',
      recurringRes.status === 201 && recurringRes.data.recurrence.frequency === 'daily'
        && recurringRes.data.recurrence.interval === 2,
      recurringRes);

    const inWindow = await api('GET', '/calendar?start=2026-11-01T00:00:00.000Z&end=2026-11-30T23:59:59.999Z', {
      token: ownerToken,
    });
    check('get events in window', inWindow.status === 200 && inWindow.data.length === 2, inWindow.data && inWindow.data.length);

    const outWindow = await api('GET', '/calendar?start=2026-12-01T00:00:00.000Z&end=2026-12-31T23:59:59.999Z', {
      token: ownerToken,
    });
    check('get events out of window', outWindow.status === 200 && outWindow.data.length === 0, outWindow.data);

    const eventUpdate = await api('PUT', `/calendar/${eventRes.data._id}`, {
      token: ownerToken, body: { title: 'Dentist (moved)' },
    });
    check('update event', eventUpdate.status === 200 && eventUpdate.data.title === 'Dentist (moved)', eventUpdate);

    // The tasks section cleared task2's dueDate — restore it as the sync fixture.
    await api('PUT', `/tasks/${task2._id}`, { token: ownerToken, body: { dueDate: '2026-11-15' } });
    const syncRes = await api('GET', '/calendar/sync-tasks', { token: ownerToken });
    check('sync-tasks only includes dated tasks',
      syncRes.status === 200 && syncRes.data.length === 1
        && syncRes.data[0].title === '📅 Dated task'
        && syncRes.data[0].color === '#6366f1',
      syncRes.data);

    const eventDelete = await api('DELETE', `/calendar/${eventRes.data._id}`, { token: ownerToken });
    check('delete event', eventDelete.status === 200, eventDelete);
    const eventDelete2 = await api('DELETE', `/calendar/${eventRes.data._id}`, { token: ownerToken });
    check('delete event again → 404', eventDelete2.status === 404, eventDelete2);

    // ----------------------------------------------------------- sleep ----
    console.log('\nsleep');
    const sleepRes = await api('POST', '/sleep', {
      token: ownerToken,
      body: {
        date: '2026-11-09',
        sleepStart: '2026-11-09T23:00:00.000Z',
        sleepEnd: '2026-11-10T07:00:00.000Z',
        quality: 'good',
        notes: 'restful',
      },
    });
    check('create sleep computes duration',
      sleepRes.status === 201 && sleepRes.data.duration === 480 && sleepRes.data.quality === 'good',
      sleepRes);

    const sleepsRes = await api('GET', '/sleep', { token: ownerToken });
    check('get sleeps', sleepsRes.status === 200 && sleepsRes.data.length === 1, sleepsRes.data);

    const sleepUpdate = await api('PUT', `/sleep/${sleepRes.data._id}`, {
      token: ownerToken,
      body: {
        date: '2026-11-09',
        sleepStart: '2026-11-09T22:00:00.000Z',
        sleepEnd: '2026-11-10T07:00:00.000Z',
        quality: 'excellent',
        notes: 'deep',
      },
    });
    check('update sleep recomputes duration',
      sleepUpdate.status === 200 && sleepUpdate.data.duration === 540
        && sleepUpdate.data.quality === 'excellent',
      sleepUpdate);

    const badSleep = await api('PUT', `/sleep/${sleepRes.data._id}`, {
      token: ownerToken,
      body: {
        date: '2026-11-09',
        sleepStart: '2026-11-09T22:00:00.000Z',
        sleepEnd: '2026-11-10T07:00:00.000Z',
        quality: 'awful',
      },
    });
    check('invalid sleep quality → 500', badSleep.status === 500, badSleep);

    // Frontend never passes `cycles` — defaults (numbers) are what the app uses.
    const sleepTime = await api('GET', '/sleep/analyzer/sleep-time?wakeTime=2026-11-11T07:00:00.000Z', {
      token: ownerToken,
    });
    check('analyzer sleep-time suggestions',
      sleepTime.status === 200 && sleepTime.data.suggestions.length === 3
        && sleepTime.data.suggestions[0].cycles === 5,
      sleepTime.data);

    const wakeTime = await api('GET', '/sleep/analyzer/wake-time?sleepTime=2026-11-10T23:00:00.000Z', {
      token: ownerToken,
    });
    check('analyzer wake-time suggestions',
      wakeTime.status === 200 && wakeTime.data.suggestions.length === 4
        && wakeTime.data.suggestions[0].cycles === 3,
      wakeTime.data);

    const sleepDelete = await api('DELETE', `/sleep/${sleepRes.data._id}`, { token: ownerToken });
    check('delete sleep', sleepDelete.status === 200, sleepDelete);

    // ----------------------------------------------------------- notes ----
    console.log('\nnotes');
    const untitledRes = await api('POST', '/notes', { token: ownerToken, body: {} });
    check('create note applies defaults',
      untitledRes.status === 201 && untitledRes.data.title === 'Untitled Note'
        && untitledRes.data.content === '' && untitledRes.data.category === 'General'
        && typeof untitledRes.data.lastEdited === 'string',
      untitledRes);

    const groceries = (await api('POST', '/notes', {
      token: ownerToken,
      body: { title: 'Groceries', content: 'buy milk and eggs', category: 'Home' },
    })).data;
    const workPlan = (await api('POST', '/notes', {
      token: ownerToken,
      body: { title: 'Work plan', content: 'ship the milk report', category: 'Work' },
    })).data;

    const allNotes = await api('GET', '/notes', { token: ownerToken });
    check('get notes', allNotes.status === 200 && allNotes.data.length === 3, allNotes.data && allNotes.data.length);

    const homeNotes = await api('GET', '/notes?category=Home', { token: ownerToken });
    check('get notes by category',
      homeNotes.status === 200 && homeNotes.data.length === 1 && homeNotes.data[0]._id === groceries._id,
      homeNotes.data);

    const searchMilk = await api('GET', '/notes?search=milk', { token: ownerToken });
    check('search single term', searchMilk.status === 200 && searchMilk.data.length === 2, searchMilk.data && searchMilk.data.length);

    const searchPhrase = await api('GET', `/notes?search=${encodeURIComponent('milk report')}`, { token: ownerToken });
    check('search multi-term AND',
      searchPhrase.status === 200 && searchPhrase.data.length === 1
        && searchPhrase.data[0]._id === workPlan._id,
      searchPhrase.data);

    const fallbackCats = await api('GET', '/notes/categories', { token: ownerToken });
    const fallbackNames = Array.isArray(fallbackCats.data) ? [...fallbackCats.data].sort() : fallbackCats.data;
    check('categories fall back to note-derived names',
      fallbackCats.status === 200
        && JSON.stringify(fallbackNames) === JSON.stringify(['General', 'Home', 'Work']),
      fallbackCats.data);

    const catCreate = await api('POST', '/notes/categories', { token: ownerToken, body: { name: 'Home' } });
    check('create category doc', catCreate.status === 201 && catCreate.data === 'Home', catCreate);

    const catDup = await api('POST', '/notes/categories', { token: ownerToken, body: { name: 'Home' } });
    check('create duplicate category → 200 existing', catDup.status === 200 && catDup.data === 'Home', catDup);

    const catEmpty = await api('POST', '/notes/categories', { token: ownerToken, body: { name: '   ' } });
    check('create blank category → 400', catEmpty.status === 400, catEmpty);

    const catsAfterCreate = await api('GET', '/notes/categories', { token: ownerToken });
    check('category docs replace fallback once present',
      Array.isArray(catsAfterCreate.data) && catsAfterCreate.data.length === 1
        && catsAfterCreate.data[0] === 'Home',
      catsAfterCreate.data);

    const catRename = await api('PUT', '/notes/categories/Home', {
      token: ownerToken, body: { name: 'Renamed' },
    });
    check('rename category', catRename.status === 200 && catRename.data === 'Renamed', catRename);

    const notesAfterRename = await api('GET', '/notes?category=Renamed', { token: ownerToken });
    check('rename cascades to notes',
      notesAfterRename.status === 200 && notesAfterRename.data.length === 1
        && notesAfterRename.data[0]._id === groceries._id,
      notesAfterRename.data);

    const otherCat = await api('POST', '/notes/categories', { token: ownerToken, body: { name: 'Other' } });
    check('create second category', otherCat.status === 201, otherCat);

    const conflictRename = await api('PUT', '/notes/categories/Renamed', {
      token: ownerToken, body: { name: 'Other' },
    });
    check('rename onto existing category → 409', conflictRename.status === 409, conflictRename);

    const notesAfterConflict = await api('GET', '/notes?category=Renamed', { token: ownerToken });
    check('failed rename leaves notes untouched',
      notesAfterConflict.status === 200 && notesAfterConflict.data.length === 1, notesAfterConflict.data);

    const noteUpdate = await api('PUT', `/notes/${groceries._id}`, {
      token: ownerToken, body: { content: 'buy oat milk' },
    });
    check('update note bumps lastEdited',
      noteUpdate.status === 200 && noteUpdate.data.content === 'buy oat milk'
        && Date.parse(noteUpdate.data.lastEdited) >= Date.parse(groceries.lastEdited),
      noteUpdate);

    const delOther = await api('DELETE', '/notes/categories/Other', { token: ownerToken });
    check('delete category doc', delOther.status === 200, delOther);

    const delRenamed = await api('DELETE', '/notes/categories/Renamed', { token: ownerToken });
    check('delete category cascades notes to General',
      delRenamed.status === 200, delRenamed);

    const notesAfterDelete = await api('GET', '/notes?category=General', { token: ownerToken });
    check('notes reset to General after category delete',
      notesAfterDelete.status === 200
        && notesAfterDelete.data.some((n) => n._id === groceries._id),
      notesAfterDelete.data && notesAfterDelete.data.map((n) => n.category));

    const delCatAgain = await api('DELETE', '/notes/categories/General', { token: ownerToken });
    check('delete missing category is idempotent', delCatAgain.status === 200, delCatAgain);

    const noteDelete = await api('DELETE', `/notes/${workPlan._id}`, { token: ownerToken });
    check('delete note', noteDelete.status === 200, noteDelete);

    // ----------------------------------------------------------- money ----
    console.log('\nmoney');
    const init1 = await api('POST', '/money/categories/init', { token: ownerToken });
    check('init default categories → 201', init1.status === 201, init1);
    const init2 = await api('POST', '/money/categories/init', { token: ownerToken });
    check('init again → 200 idempotent', init2.status === 200, init2);

    const moneyCats = await api('GET', '/money/categories', { token: ownerToken });
    check('get money categories (16)', moneyCats.status === 200 && moneyCats.data.categories.length === 16,
      moneyCats.data && moneyCats.data.categories.length);

    const incomeCats = await api('GET', '/money/categories?type=income', { token: ownerToken });
    check('filter money categories by type',
      incomeCats.status === 200 && incomeCats.data.categories.length === 6
        && incomeCats.data.categories.every((c) => c.type === 'income'),
      incomeCats.data && incomeCats.data.categories.length);

    const novExpense = (await api('POST', '/money/transactions', {
      token: ownerToken,
      body: { type: 'expense', amount: 12.5, category: 'Food', date: '2026-11-05' },
    }));
    check('add expense transaction',
      novExpense.status === 201 && novExpense.data.transaction.amount === 12.5,
      novExpense);

    const novIncome = (await api('POST', '/money/transactions', {
      token: ownerToken,
      body: { type: 'income', amount: 500, category: 'Salary', date: '2026-11-10' },
    }));
    check('add income transaction', novIncome.status === 201, novIncome);

    const octExpense = (await api('POST', '/money/transactions', {
      token: ownerToken,
      body: { type: 'expense', amount: 99, category: 'Bills', date: '2026-10-15' },
    }));
    check('add previous-month transaction', octExpense.status === 201, octExpense);

    const noRange = await api('GET', '/money/transactions', { token: ownerToken });
    check('monthly transactions without range → 400', noRange.status === 400, noRange);

    const monthly = await api('GET', '/money/transactions?year=2026&month=11', { token: ownerToken });
    const totals = monthly.data && monthly.data.totals;
    check('monthly totals computed',
      monthly.status === 200 && monthly.data.transactions.length === 2
        && totals.income === 500 && totals.expense === 12.5 && totals.net === 487.5
        && totals.byCategory.Food.expense === 12.5,
      monthly.data && monthly.data.totals);

    const allTx = await api('GET', '/money/transactions/all', { token: ownerToken });
    check('all transactions across months', allTx.status === 200 && allTx.data.length === 3, allTx.data && allTx.data.length);

    const txUpdate = await api('PUT', `/money/transactions/${novExpense.data.transaction._id}`, {
      token: ownerToken,
      body: { type: 'expense', amount: 20, category: 'Food', description: 'lunch', date: '2026-11-05' },
    });
    check('update transaction',
      txUpdate.status === 200 && txUpdate.data.transaction.amount === 20
        && txUpdate.data.transaction.description === 'lunch',
      txUpdate);

    const addCat = await api('POST', '/money/categories', {
      token: ownerToken, body: { name: 'Snacks', type: 'expense', color: '#ff0000' },
    });
    check('add money category', addCat.status === 201 && addCat.data.category.color === '#ff0000', addCat);

    const addCatDup = await api('POST', '/money/categories', {
      token: ownerToken, body: { name: 'Other', type: 'expense' },
    });
    check('duplicate money category → 400', addCatDup.status === 400, addCatDup);

    const delCat = await api('DELETE', `/money/categories/${addCat.data.category._id}`, { token: ownerToken });
    check('delete money category', delCat.status === 200, delCat);

    const delTx = await api('DELETE', `/money/transactions/${novIncome.data.transaction._id}`, { token: ownerToken });
    check('delete transaction', delTx.status === 200, delTx);

    const defaults = await api('GET', '/money/categories/default', { token: ownerToken });
    check('default category lists',
      defaults.status === 200 && defaults.data.categories.expense.length === 10
        && defaults.data.categories.income.length === 6,
      defaults.data);

    // ----------------------------------------------------- whiteboards ----
    console.log('\nwhiteboards');
    const boardRes = await api('POST', '/whiteboards', { token: ownerToken, body: {} });
    check('create whiteboard applies defaults',
      boardRes.status === 201 && boardRes.data.title === 'Untitled Board'
        && Array.isArray(boardRes.data.elements) && boardRes.data.elements.length === 0
        && boardRes.data.background === 'grid' && typeof boardRes.data.lastEdited === 'string',
      boardRes);

    const board2Res = await api('POST', '/whiteboards', {
      token: ownerToken,
      body: { title: 'Mind map', elements: [{ type: 'rect', x: 1 }], background: 'dots' },
    });
    check('create whiteboard with content',
      board2Res.status === 201 && board2Res.data.elements.length === 1
        && board2Res.data.background === 'dots',
      board2Res);

    const boardsRes = await api('GET', '/whiteboards', { token: ownerToken });
    check('get whiteboards', boardsRes.status === 200 && boardsRes.data.length === 2, boardsRes.data && boardsRes.data.length);

    const boardById = await api('GET', `/whiteboards/${board2Res.data._id}`, { token: ownerToken });
    check('get whiteboard by id', boardById.status === 200 && boardById.data.title === 'Mind map', boardById);

    const board404 = await api('GET', '/whiteboards/nope', { token: ownerToken });
    check('get missing whiteboard → 404', board404.status === 404, board404);

    const boardUpdate = await api('PUT', `/whiteboards/${board2Res.data._id}`, {
      token: ownerToken,
      body: { title: 'Mind map v2', elements: [{ type: 'rect', x: 2 }] },
    });
    check('update whiteboard',
      boardUpdate.status === 200 && boardUpdate.data.title === 'Mind map v2'
        && boardUpdate.data.elements[0].x === 2
        && Date.parse(boardUpdate.data.lastEdited) >= Date.parse(board2Res.data.lastEdited),
      boardUpdate);

    const boardDelete = await api('DELETE', `/whiteboards/${board2Res.data._id}`, { token: ownerToken });
    check('delete whiteboard', boardDelete.status === 200, boardDelete);
    const boardDelete2 = await api('DELETE', `/whiteboards/${board2Res.data._id}`, { token: ownerToken });
    check('delete whiteboard again → 404', boardDelete2.status === 404, boardDelete2);

    // --------------------------------------------------- scope isolation --
    console.log('\nscope isolation');
    const otherLists = await api('GET', '/lists', { token: otherToken });
    check("other user sees none of owner's lists",
      otherLists.status === 200 && otherLists.data.length === 0, otherLists.data);

    const otherPutList = await api('PUT', `/lists/${inbox._id}`, {
      token: otherToken, body: { name: 'hijacked' },
    });
    check("other user cannot update owner's list → 404", otherPutList.status === 404, otherPutList);

    const otherDelTask = await api('DELETE', `/tasks/${task2._id}`, { token: otherToken });
    check("other user cannot delete owner's task → 404", otherDelTask.status === 404, otherDelTask);

    const otherHabits = await api('GET', '/habits', { token: otherToken });
    check("other user sees none of owner's habits",
      otherHabits.status === 200 && otherHabits.data.length === 0, otherHabits.data);

    const otherNotes = await api('GET', '/notes', { token: otherToken });
    check("other user sees none of owner's notes",
      otherNotes.status === 200 && otherNotes.data.length === 0, otherNotes.data);

    const otherMonthly = await api('GET', '/money/transactions?year=2026&month=11', { token: otherToken });
    check("other user sees none of owner's transactions",
      otherMonthly.status === 200 && otherMonthly.data.transactions.length === 0
        && otherMonthly.data.totals.net === 0,
      otherMonthly.data);

    const otherBoards = await api('GET', '/whiteboards', { token: otherToken });
    check("other user sees none of owner's whiteboards",
      otherBoards.status === 200 && otherBoards.data.length === 0, otherBoards.data);

    const ownerStillHasTask = await api('GET', `/tasks?listId=${inbox._id}`, { token: ownerToken });
    check("owner's task survived other user's delete attempt",
      ownerStillHasTask.status === 200 && ownerStillHasTask.data.length === 1, ownerStillHasTask.data);
  } finally {
    server.close();
    closeDatabase();
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        fs.rmSync(dbPath + suffix);
      } catch (error) {
        // Already gone.
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Smoke gate crashed:', error);
  process.exit(1);
});
