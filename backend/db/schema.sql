-- Bickle SQLite schema — single source of truth for all 20 tables.
-- Design rules (see SQLITE-ELECTRON-PLAN.md):
--   * Column names mirror the API field names exactly, so SELECT * rows are
--     almost the JSON response (helpers mapRow/docToRow handle bools + JSON).
--   * _id is a UUID text primary key (replaces Mongo ObjectId).
--   * Dates are ISO-8601 TEXT (identical to what Mongoose serialized).
--   * Booleans are INTEGER 0/1 (converted on read/write by helpers).
--   * Embedded objects/arrays that are never queried live in JSON TEXT cols;
--     the only queried arrays (participants, readBy) get junction tables.
--   * guestSession IS NULL marks the owner partition (never a missing column).
--   * No FOREIGN KEYs: mongoose refs were never enforced either.
--   * IF NOT EXISTS everywhere: safe to run on every boot.

-- ---------------------------------------------------------------- auth ----
CREATE TABLE IF NOT EXISTS "users" (
  "_id"          TEXT PRIMARY KEY,
  "username"     TEXT NOT NULL UNIQUE,
  "email"        TEXT NOT NULL UNIQUE,
  "password"     TEXT NOT NULL,
  "avatar"       TEXT NOT NULL DEFAULT '',
  "showcase"     INTEGER NOT NULL DEFAULT 0,
  "preferences"  TEXT NOT NULL DEFAULT '{"theme":"dark","notifications":true}',
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "guest_sessions" (
  "_id"          TEXT PRIMARY KEY,
  "owner"        TEXT NOT NULL,
  "label"        TEXT NOT NULL DEFAULT 'Guest',
  "allowedPages" TEXT NOT NULL DEFAULT '[]',
  "pageAccess"   TEXT NOT NULL DEFAULT '{}',
  "sharedItems"  TEXT NOT NULL DEFAULT '[]',
  "token"        TEXT NOT NULL UNIQUE,
  "expiresAt"    TEXT NOT NULL,
  "active"       INTEGER NOT NULL DEFAULT 1,
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_guest_sessions_owner"   ON "guest_sessions"("owner");
CREATE INDEX IF NOT EXISTS "idx_guest_sessions_expires" ON "guest_sessions"("expiresAt");

-- ---------------------------------------------------------------- chat ----
CREATE TABLE IF NOT EXISTS "conversations" (
  "_id"           TEXT PRIMARY KEY,
  "lastMessage"   TEXT NOT NULL DEFAULT '{"text":""}',
  "disappearMode" TEXT NOT NULL DEFAULT 'off'
                    CHECK ("disappearMode" IN ('off','1h','24h','7d','viewed')),
  "createdAt"     TEXT NOT NULL,
  "updatedAt"     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversation_participants" (
  "conversationId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  PRIMARY KEY ("conversationId", "userId")
);
CREATE INDEX IF NOT EXISTS "idx_conv_participants_user"
  ON "conversation_participants"("userId");

CREATE TABLE IF NOT EXISTS "messages" (
  "_id"            TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "sender"         TEXT NOT NULL,
  "type"           TEXT NOT NULL DEFAULT 'text' CHECK ("type" IN ('text','system')),
  "text"           TEXT NOT NULL DEFAULT '' CHECK (length("text") <= 4000),
  "attachment"     TEXT,                    -- NULL = no attachment (key omitted on read)
  "disappear"      TEXT NOT NULL DEFAULT 'off'
                     CHECK ("disappear" IN ('off','1h','24h','7d','viewed')),
  "expiresAt"      TEXT,
  "viewedAt"       TEXT,
  "createdAt"      TEXT NOT NULL,
  "updatedAt"      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_messages_conversation_created"
  ON "messages"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_messages_conversation_expires"
  ON "messages"("conversationId", "expiresAt");

CREATE TABLE IF NOT EXISTS "message_read_by" (
  "messageId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  PRIMARY KEY ("messageId", "userId")
);
CREATE INDEX IF NOT EXISTS "idx_message_read_by_user" ON "message_read_by"("userId");

-- --------------------------------------------------------------- tasks ----
CREATE TABLE IF NOT EXISTS "task_lists" (
  "_id"          TEXT PRIMARY KEY,
  "user"         TEXT NOT NULL,
  "guestSession" TEXT,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "isFavorite"   INTEGER NOT NULL DEFAULT 0,
  "color"        TEXT NOT NULL DEFAULT '#6366f1',
  "statuses"     TEXT NOT NULL DEFAULT '[]',
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_task_lists_scope" ON "task_lists"("user", "guestSession");

CREATE TABLE IF NOT EXISTS "tasks" (
  "_id"          TEXT PRIMARY KEY,
  "user"         TEXT NOT NULL,
  "guestSession" TEXT,
  "list"         TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "dueDate"      TEXT,
  "priority"     TEXT NOT NULL DEFAULT 'medium'
                   CHECK ("priority" IN ('low','medium','high')),
  "status"       TEXT NOT NULL DEFAULT 'todo',
  "tags"         TEXT NOT NULL DEFAULT '[]',
  "isStarred"    INTEGER NOT NULL DEFAULT 0,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_tasks_scope" ON "tasks"("user", "guestSession");
CREATE INDEX IF NOT EXISTS "idx_tasks_list"  ON "tasks"("list");

-- ------------------------------------------------------------ calendar ----
CREATE TABLE IF NOT EXISTS "calendar_events" (
  "_id"          TEXT PRIMARY KEY,
  "user"         TEXT NOT NULL,
  "guestSession" TEXT,
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "start"        TEXT NOT NULL,
  "end"          TEXT NOT NULL,
  "allDay"       INTEGER NOT NULL DEFAULT 0,
  "color"        TEXT NOT NULL DEFAULT '#6366f1',
  "recurrence"   TEXT NOT NULL DEFAULT '{"frequency":"none","interval":1}',
  "task"         TEXT,
  "location"     TEXT,
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_calendar_events_scope" ON "calendar_events"("user", "guestSession");
CREATE INDEX IF NOT EXISTS "idx_calendar_events_start" ON "calendar_events"("start");

-- -------------------------------------------------------------- habits ----
-- Habit has no mongoose timestamps option — manual createdAt only.
CREATE TABLE IF NOT EXISTS "habits" (
  "_id"            TEXT PRIMARY KEY,
  "userId"         TEXT NOT NULL,
  "guestSession"   TEXT,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "frequency"      TEXT NOT NULL DEFAULT 'daily'
                     CHECK ("frequency" IN ('daily','weekly','monthly')),
  "streak"         INTEGER NOT NULL DEFAULT 0,
  "lastCompleted"  TEXT,
  "completedDates" TEXT NOT NULL DEFAULT '[]',
  "createdAt"      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_habits_scope" ON "habits"("userId", "guestSession");

-- --------------------------------------------------------------- notes ----
CREATE TABLE IF NOT EXISTS "notes" (
  "_id"          TEXT PRIMARY KEY,
  "user"         TEXT NOT NULL,
  "guestSession" TEXT,
  "title"        TEXT NOT NULL DEFAULT 'Untitled Note',
  "content"      TEXT NOT NULL DEFAULT '',
  "category"     TEXT NOT NULL DEFAULT 'General',
  "tags"         TEXT NOT NULL DEFAULT '[]',
  "isPinned"     INTEGER NOT NULL DEFAULT 0,
  "lastEdited"   TEXT NOT NULL,
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_notes_scope" ON "notes"("user", "guestSession");

CREATE TABLE IF NOT EXISTS "categories" (
  "_id"          TEXT PRIMARY KEY,
  "user"         TEXT NOT NULL,
  "guestSession" TEXT,
  "name"         TEXT NOT NULL,
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
-- Unique per partition. SQLite treats NULLs as distinct in UNIQUE indexes,
-- so partial indexes reproduce Mongo's null-as-value semantics exactly.
CREATE UNIQUE INDEX IF NOT EXISTS "ux_categories_owner"
  ON "categories"("user", "name") WHERE "guestSession" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ux_categories_guest"
  ON "categories"("user", "guestSession", "name") WHERE "guestSession" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_categories_scope" ON "categories"("user", "guestSession");

-- --------------------------------------------------------------- sleep ----
CREATE TABLE IF NOT EXISTS "sleeps" (
  "_id"          TEXT PRIMARY KEY,
  "user"         TEXT NOT NULL,
  "guestSession" TEXT,
  "date"         TEXT NOT NULL,
  "sleepStart"   TEXT NOT NULL,
  "sleepEnd"     TEXT NOT NULL,
  "duration"     INTEGER NOT NULL,
  "quality"      TEXT NOT NULL DEFAULT 'good'
                   CHECK ("quality" IN ('poor','fair','good','excellent')),
  "notes"        TEXT,
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_sleeps_scope" ON "sleeps"("user", "guestSession");

-- --------------------------------------------------------------- money ----
CREATE TABLE IF NOT EXISTS "transactions" (
  "_id"          TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL,
  "guestSession" TEXT,
  "type"         TEXT NOT NULL CHECK ("type" IN ('income','expense')),
  "amount"       REAL NOT NULL CHECK ("amount" >= 0),
  "category"     TEXT NOT NULL,
  "description"  TEXT NOT NULL DEFAULT '',
  "date"         TEXT NOT NULL,
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_transactions_user_date"     ON "transactions"("userId", "date");
CREATE INDEX IF NOT EXISTS "idx_transactions_user_category" ON "transactions"("userId", "category");
CREATE INDEX IF NOT EXISTS "idx_transactions_scope"         ON "transactions"("userId", "guestSession");

CREATE TABLE IF NOT EXISTS "user_categories" (
  "_id"          TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL,
  "guestSession" TEXT,
  "name"         TEXT NOT NULL,
  "type"         TEXT NOT NULL CHECK ("type" IN ('income','expense')),
  "color"        TEXT NOT NULL DEFAULT '#3B82F6',
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_user_categories_owner"
  ON "user_categories"("userId", "name", "type") WHERE "guestSession" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ux_user_categories_guest"
  ON "user_categories"("userId", "guestSession", "name", "type") WHERE "guestSession" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_user_categories_scope" ON "user_categories"("userId", "guestSession");

-- --------------------------------------------------------- whiteboards ----
CREATE TABLE IF NOT EXISTS "whiteboards" (
  "_id"          TEXT PRIMARY KEY,
  "user"         TEXT NOT NULL,
  "guestSession" TEXT,
  "title"        TEXT NOT NULL DEFAULT 'Untitled Board',
  "elements"     TEXT NOT NULL DEFAULT '[]',
  "background"   TEXT NOT NULL DEFAULT 'grid',
  "lastEdited"   TEXT NOT NULL,
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_whiteboards_scope" ON "whiteboards"("user", "guestSession");

-- ----------------------------------------------------------------- art ----
CREATE TABLE IF NOT EXISTS "art_blogs" (
  "_id"          TEXT PRIMARY KEY,
  "user"         TEXT NOT NULL,
  "guestSession" TEXT,
  "sharedCopy"   INTEGER NOT NULL DEFAULT 0,
  "title"        TEXT NOT NULL,
  "content"      TEXT NOT NULL DEFAULT '',
  "images"       TEXT NOT NULL DEFAULT '[]',
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_art_blogs_scope" ON "art_blogs"("user", "guestSession");

CREATE TABLE IF NOT EXISTS "art_photos" (
  "_id"          TEXT PRIMARY KEY,
  "user"         TEXT NOT NULL,
  "guestSession" TEXT,
  "sharedCopy"   INTEGER NOT NULL DEFAULT 0,
  "title"        TEXT NOT NULL DEFAULT '',
  "description"  TEXT NOT NULL DEFAULT '',
  "location"     TEXT NOT NULL DEFAULT '',
  "takenAt"      TEXT,
  "camera"       TEXT NOT NULL DEFAULT '',
  "url"          TEXT NOT NULL,
  "name"         TEXT NOT NULL DEFAULT '',
  "size"         INTEGER NOT NULL DEFAULT 0,
  "width"        INTEGER NOT NULL DEFAULT 0,
  "height"       INTEGER NOT NULL DEFAULT 0,
  "source"       TEXT NOT NULL DEFAULT 'upload' CHECK ("source" IN ('upload','blog')),
  "blog"         TEXT,
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_art_photos_scope" ON "art_photos"("user", "guestSession");

CREATE TABLE IF NOT EXISTS "art_videos" (
  "_id"          TEXT PRIMARY KEY,
  "user"         TEXT NOT NULL,
  "guestSession" TEXT,
  "sharedCopy"   INTEGER NOT NULL DEFAULT 0,
  "title"        TEXT NOT NULL DEFAULT '',
  "description"  TEXT NOT NULL DEFAULT '',
  "location"     TEXT NOT NULL DEFAULT '',
  "recordedAt"   TEXT,
  "url"          TEXT NOT NULL,
  "name"         TEXT NOT NULL DEFAULT '',
  "size"         INTEGER NOT NULL DEFAULT 0,
  "duration"     INTEGER NOT NULL DEFAULT 0,
  "width"        INTEGER NOT NULL DEFAULT 0,
  "height"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_art_videos_scope" ON "art_videos"("user", "guestSession");

CREATE TABLE IF NOT EXISTS "art_music" (
  "_id"          TEXT PRIMARY KEY,
  "user"         TEXT NOT NULL,
  "guestSession" TEXT,
  "sharedCopy"   INTEGER NOT NULL DEFAULT 0,
  "title"        TEXT NOT NULL DEFAULT '',
  "description"  TEXT NOT NULL DEFAULT '',
  "madeAt"       TEXT,
  "url"          TEXT NOT NULL,
  "name"         TEXT NOT NULL DEFAULT '',
  "size"         INTEGER NOT NULL DEFAULT 0,
  "duration"     INTEGER NOT NULL DEFAULT 0,
  "peaks"        TEXT NOT NULL DEFAULT '[]',
  "createdAt"    TEXT NOT NULL,
  "updatedAt"    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_art_music_scope" ON "art_music"("user", "guestSession");
