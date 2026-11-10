# Bickle → SQLite + Electron Migration Plan

**Goal:** make Bickle plug-and-play — a double-click install on Linux and Windows (macOS later via CI) with no Node, npm, MongoDB, or terminal required on the user's machine. Data lives in one folder; backup = copy one file.

**Decisions locked:**
- Fresh start — no MongoDB data import (new empty database on first launch)
- Installers: Linux (AppImage/deb) + Windows (.exe via Wine) in this effort; macOS `.dmg` deferred to GitHub Actions later
- Existing dev/web mode keeps working (`node backend/server.js` still runs standalone)

**Success criteria:**
- `npm test` (all 3 suites) green — proves API behavior is unchanged
- **Zero frontend changes** — research-confirmed: preserving the API contract (`_id` as UUID string, ISO dates, identical JSON shapes) means the React app is untouched
- AppImage runs on an environment with no Node installed

---

## Research summary (what the codebase actually looks like)

- **81 endpoints, 17 models, 11 controllers** — but only **1 `populate()`**, **zero aggregations**, **zero transactions**, **zero upserts**
- **Frontend coupling: none** — 237 `_id` usages, zero id-format validation/parsing; the app already mixes server ObjectIds with client-generated non-hex ids (`Whiteboard.jsx:64`)
- Real complexity lives in:
  - Guest partitioning (`user` + `guestSession` NULL semantics, spread across ~40 query sites)
  - Chat array queries (`participants` contains, `readBy` not-contains, `readBy` `$all`)
  - Two `pre('save')` hooks (bcrypt hash, default task-list statuses)
  - 3 test suites that assert against MongoDB directly
- Only one populated field: `unread-count.latest.sender` → must stay a username **string**
- Backend response contract to preserve: `peer` as object, `message.sender`/`readBy` as id strings, `task.list` as id string, ISO-8601 timestamps, `_id` always a plain string

---

## Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| DB driver | **better-sqlite3** | Battle-tested, Electron prebuilds exist, synchronous = trivial transactions. (`node:sqlite` is still experimental in Electron's Node.) |
| Primary key | `_id TEXT PRIMARY KEY` = `crypto.randomUUID()` | Frontend never validates id format; already mixes in client-generated non-hex ids |
| Column names = API field names (`dueDate`, `isStarred`, quoted camelCase) | | Eliminates an entire serialization layer across 81 endpoints — `SELECT *` row *is* the JSON body. Biggest correctness win available |
| Dates | ISO-8601 TEXT (`toISOString()`) | Byte-identical to what Mongoose serializes today; lexicographic sort = chronological |
| Booleans | 0/1 columns + per-table converter on read/write | SQLite has no boolean; converter flips to real `true/false` (frontend does `=== true` checks) |
| Embedded objects/arrays never queried | JSON TEXT columns (`tags`, `statuses`, `elements`, `recurrence`, `lastMessage`, `attachment`, `pageAccess`, `sharedItems`, `completedDates`, `preferences`, `peaks`, `images`) | ~12 columns total; app-side validation replaces Mongoose subdoc validation |
| The two queried arrays | Junction tables: `conversation_participants`, `message_read_by` | Chat queries `participants` contains, `readBy` not-contains, `readBy` `$all` — SQL `EXISTS` predicates, indexed |
| Owner partition | `WHERE user = ? AND guestSession IS NULL` | Fresh DB ⇒ no legacy missing-field problem; every row always writes the column |
| Unique + NULL trap | **Partial unique indexes** (`... WHERE guestSession IS NULL`) | SQLite treats NULLs as distinct (Mongo doesn't) — hits exactly the 2 indexes where `server.js` already calls `syncIndexes()` |
| Error handling | Small shims in `db/errors.js` carrying `name: 'ValidationError'`, `code: 11000`, `kind: 'ObjectId'` | The ~10 controller branches keep working **verbatim**; no mongoose import anywhere |
| Atomicity | `db.transaction(() => ...)` | better-sqlite3 is sync — *fixes* today's non-atomic writes (sendMessage + conversation save, deleteList + tasks, etc.) |
| Hooks | Re-homed: explicit `bcrypt.hash` in register/create-profile/updateMe/seed; default statuses in `createList` | The only 2 `pre('save')` hooks; update endpoints already bypass them today |
| Note search | Multi-term `LIKE` (not FTS5) | Personal scale; no trigger machinery. FTS5 is a later upgrade if needed |
| Electron loading | Window loads `http://127.0.0.1:<ephemeral>/bickle/` | **Not** `file://` — embedded Express serves API + dist + uploads, so every relative URL, guest link, and upload path works untouched |
| Port default | **9000** | Matches Vite proxy (`vite.config.js:43`) and production; tests pass explicit ports anyway |

**Env vars after:** `SQLITE_PATH`, `UPLOAD_DIR`, `SERVE_DIST`, `PORT`, `JWT_SECRET`, `SEED_PASSWORD`.
**Removed:** `MONGODB_URI`, mongodb-memory-server fallback.

## New file layout

```
backend/db/
  index.js      — openDatabase(): pragmas (WAL, foreign_keys, busy_timeout), runs schema.sql on first boot
  schema.sql    — 20 tables + all indexes (single DDL source of truth, from the model inventory)
  helpers.js    — newId(), nowIso(), insert/update/find/delete wrappers, mapRow (bools+JSON), docToRow
  errors.js     — ValidationError / DuplicateError / CastError shims
  tables.js     — per-table metadata: { bools: [...], json: [...] }
```

Tables: `users, guest_sessions, conversations, conversation_participants, messages, message_read_by, task_lists, tasks, calendar_events, habits, notes, categories, sleeps, transactions, user_categories, whiteboards, art_blogs, art_photos, art_videos, art_music`

---

## Phases

### Phase 0 — Scaffolding (branch `sqlite`)
Add `better-sqlite3`; create `backend/db/*` with full schema from the model inventory; a tiny round-trip script (insert/read bool + JSON + date + UUID).
**Gate:** script passes.

### Phase 1 — Server boots on SQLite; auth works
Rewire `server.js` (drop mongoose/connect/fallback/syncIndexes; keep `purgeStaleSessions` + `ensureProfileAccounts` as SQL; export `startServer(options)` with CLI preserved). Migrate `middleware/auth.js`, `middleware/scope.js` (`scopeFilter` → SQL fragment), `authController`, `utils/seedProfiles.js`.
**Gate:** `npm run dev` → register/login/`GET /me` works; both seeded profiles exist.

### Phase 2 — Core CRUD modules
Migrate in order: **lists+tasks** (coupled), **habits** (`userId` owner key), **calendar**, **sleep**, **notes+categories** (`LIKE` search, `DISTINCT category`, rename dual-sync), **money+user_categories** (`insertMany` defaults → multi-row INSERT), **whiteboards**. Routes files untouched — handlers only.
**Gate:** new `backend/smoke.js` — scripted login + CRUD round-trip per module.

### Phase 3 — Chat, guest, art, settings (the hard part)
- **Chat:** junction tables, `INSERT OR IGNORE` for `$addToSet`, disappearing-message logic unchanged, `purgeExpired` on read, `lastMessage` updates inside transactions
- **Guest:** `randomUUID()` session ids in JWT, `cloneSharedItems` (SQL copies, uuid validation replacing `isValidObjectId`), `purgeGuestSession` (SQL loop over 14 tables + keep file cleanup), lazy purge in auth
- **Art:** dynamic `MODELS` map → table map, `$pull` from blog images → JSON read-modify-write in a transaction, file cleanup kept
- **Settings:** inline 5× `deleteMany` → one transaction
**Gate:** smoke extended with a guest create→isolate→revoke flow.

### Phase 4 — Tests green + Mongo removal
Rewrite the 3 test scripts: temp `SQLITE_PATH` file per run (two processes share it fine under WAL), spawn/wait-for-`"Server running"` handshake kept, direct-DB assertions → SQL via better-sqlite3, `Message.updateOne` backdating → `UPDATE`. Remove `mongoose` + `mongodb-memory-server` from `package.json`.
**Gate:** `npm test` all green (these suites prove guest isolation, chat semantics, per-profile isolation — the exact high-risk areas); no mongoose references left in backend source.

### Phase 5 — Electron shell
Root `package.json` (`main: electron/main.js`, electron devDep). `electron/main.js`: single-instance lock → `startServer({ port: 0, sqlitePath: <userData>/bickle.db, uploadDir: <userData>/uploads, serveDist: true })` → `loadURL(http://127.0.0.1:port/bickle/)` → external-link handler (`shell.openExternal`). `server.js` gains dist serving: static `/bickle` + SPA fallback + `/bickle/uploads` (keep `/uploads` too).
**Gate:** `electron .` on Linux → full app usable; restart → data persists.

### Phase 6 — Installers (Linux + Windows/Wine)
electron-builder at root: **AppImage + deb + nsis** targets; package `electron/ + backend/ (pruned) + frontend/dist/`; `asarUnpack` for `better-sqlite3`; electron-builder auto-rebuilds the native module for Electron's ABI. Convert `bickle_icon.png` → 512px png/ico. Rewrite README (users: download installer; devs: `npm i` + `npm run dev`).
**Gate:** AppImage runs on an environment with no Node installed; Wine nsis build completes.

### Optional Phase 7 — Demo seed data
`npm run seed:demo` (or first-run button) loading a realistic week of tasks/habits/events — for presentations. Decide at Phase 6.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Array-semantics bugs in chat (`readBy` not-contains / `$all`) | Junction tables + `test-users.js` chat suite exercises exactly these |
| Response-shape drift (0/1 vs `true`, dropped fields) | Column=API-name design + per-table converter; tests assert real responses |
| **Windows native module via Wine** | better-sqlite3/electron usually have prebuilds; if the build fails → fallback: build the `.exe` on any Windows machine or GitHub Actions later (macOS already deferred) |
| Guest partition escape | `IS NULL` + partial uniques + existing isolation test suite as the gate |
| Two processes on one SQLite file (server + tests) | WAL + `busy_timeout` (standard pattern) |
| Electron ABI mismatch for better-sqlite3 | electron-builder rebuilds automatically; Phase 5 gate catches it |

## Out of scope
MongoDB data import · macOS installer (CI later) · frontend changes (none needed) · FTS5 · the existing nginx/systemd web deploy (keeps working; retire its Mongo units whenever you switch)

## Execution order
`0 scaffolding → 1 auth → 2 core CRUD → 3 chat/guest/art → 4 tests+cleanup → 5 Electron → 6 installers`
Each phase has a hard gate; Phases 0–4 are ~65% of the work, 5–6 the rest.
