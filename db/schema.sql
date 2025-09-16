-- Kota's Planner persistence schema
-- Stores active tasks fetched from Canvas and created manually, while
-- keeping a durable history of completed/deleted entries so they do not
-- resurface in future syncs.

BEGIN;

CREATE TYPE todo_origin AS ENUM ('canvas', 'manual');
CREATE TYPE archive_reason AS ENUM ('completed', 'deleted');

CREATE TABLE planner_items (
    id BIGSERIAL PRIMARY KEY,
    external_id BIGINT,
    origin todo_origin NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    due_at TIMESTAMPTZ,
    scheduled_time TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    archived_reason archive_reason,
    UNIQUE (origin, external_id)
);

-- Dedicated table to log every state change so we can audit the sync
-- pipeline or restore items back into the active queue.
CREATE TABLE planner_events (
    id BIGSERIAL PRIMARY KEY,
    planner_item_id BIGINT NOT NULL REFERENCES planner_items(id) ON DELETE CASCADE,
    event_type archive_reason NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Keep a fast lookup for Canvas items that have been archived so we can
-- filter them out before rendering.
CREATE INDEX planner_items_origin_external_idx ON planner_items(origin, external_id);
CREATE INDEX planner_items_archived_idx ON planner_items(archived_reason) WHERE archived_reason IS NOT NULL;
CREATE INDEX planner_events_item_idx ON planner_events(planner_item_id, occurred_at DESC);

COMMIT;
