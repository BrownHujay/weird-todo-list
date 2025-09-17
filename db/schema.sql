-- Kota's Planner SQLite schema
-- Stores active tasks from Canvas and manual entries, with archival history
-- for completed and deleted tasks.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS planner_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER,
    origin TEXT NOT NULL CHECK (origin IN ('canvas', 'manual')),
    title TEXT NOT NULL,
    notes TEXT,
    due_at TEXT,
    scheduled_time TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    completed INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    archived_reason TEXT CHECK (archived_reason IN ('completed', 'deleted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS planner_items_origin_external_unique
    ON planner_items(origin, external_id);

CREATE INDEX IF NOT EXISTS planner_items_archived_reason_idx
    ON planner_items(archived_reason);

CREATE TABLE IF NOT EXISTS planner_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planner_item_id INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('completed', 'deleted', 'restored')),
    occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (planner_item_id) REFERENCES planner_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS planner_events_item_idx
    ON planner_events(planner_item_id, occurred_at DESC);
