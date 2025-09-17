import cors from "cors";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import express from "express";
import fetch from "node-fetch";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL =
  process.env.CANVAS_API_URL || "https://nuevaschool.instructure.com/api/v1";
const CANVAS_TOKEN = process.env.CANVAS_TOKEN;

app.use(cors());
app.use(express.json());

const dbPath = path.resolve(process.cwd(), "db", "planner.sqlite3");
const schemaPath = path.resolve(process.cwd(), "db", "schema.sql");

const ensureDirectory = path.dirname(dbPath);
if (!fs.existsSync(ensureDirectory)) {
  fs.mkdirSync(ensureDirectory, { recursive: true });
}

const db = new Database(dbPath);
const schema = fs.readFileSync(schemaPath, "utf8");
db.exec(schema);

db.pragma("foreign_keys = ON");

type ArchiveReason = "completed" | "deleted";
type EventType = ArchiveReason | "restored";
type TodoOrigin = "canvas" | "manual";

interface PlannerRow {
  id: number;
  external_id: number | null;
  origin: TodoOrigin;
  title: string;
  notes: string | null;
  due_at: string | null;
  scheduled_time: string | null;
  created_at: string | null;
  completed: 0 | 1;
  archived_at: string | null;
  archived_reason: ArchiveReason | null;
}

interface PlannerItem {
  id: number;
  external_id?: number | null;
  text: string;
  due_at: string | null;
  created_at: string | null;
  completed: boolean;
  origin: TodoOrigin;
  scheduled_time: string | null;
  archived_at: string | null;
  archived_reason?: ArchiveReason;
}

interface CanvasAssignment {
  id: number;
  name: string;
  due_at?: string | null;
  created_at?: string | null;
  locked_for_user?: boolean;
}

interface CanvasTodo {
  assignment?: CanvasAssignment;
}

const mapRowToTodo = (row: PlannerRow): PlannerItem => ({
  id: row.id,
  external_id: row.external_id ?? undefined,
  text: row.title,
  due_at: row.due_at ?? null,
  created_at: row.created_at ?? null,
  completed: Boolean(row.completed),
  origin: row.origin,
  scheduled_time: row.scheduled_time ?? null,
  archived_at: row.archived_at ?? null,
  archived_reason: row.archived_reason ?? undefined,
});

const getActiveTodos = (): PlannerItem[] =>
  (db
    .prepare(
      `SELECT * FROM planner_items
       WHERE archived_reason IS NULL
       ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
                COALESCE(due_at, created_at),
                created_at`
    )
    .all() as PlannerRow[]).map(mapRowToTodo);

const getArchivedByReason = (reason: ArchiveReason): PlannerItem[] =>
  (db
    .prepare(
      `SELECT * FROM planner_items
       WHERE archived_reason = ?
       ORDER BY archived_at DESC`
    )
    .all(reason) as PlannerRow[]).map(mapRowToTodo);

const getPlannerState = () => ({
  active: getActiveTodos(),
  archive: {
    completed: getArchivedByReason("completed"),
    deleted: getArchivedByReason("deleted"),
  },
});

const selectItemByOrigin = db.prepare(
  "SELECT * FROM planner_items WHERE origin = ? AND external_id = ?"
);

const insertManualItem = db.prepare(
  `INSERT INTO planner_items (origin, title, due_at, scheduled_time, created_at, completed)
   VALUES ('manual', @title, @due_at, @scheduled_time, @created_at, 0)`
);

const insertCanvasItem = db.prepare(
  `INSERT INTO planner_items (origin, external_id, title, due_at, scheduled_time, created_at, completed)
   VALUES ('canvas', @external_id, @title, @due_at, @scheduled_time, @created_at, 0)`
);

const updateCanvasItem = db.prepare(
  `UPDATE planner_items
   SET title = @title,
       due_at = @due_at,
       scheduled_time = @scheduled_time,
       created_at = COALESCE(created_at, @created_at)
   WHERE id = @id`
);

const archiveItemStatement = db.prepare(
  `UPDATE planner_items
   SET completed = CASE WHEN @reason = 'completed' THEN 1 ELSE completed END,
       archived_at = @archived_at,
       archived_reason = @reason
   WHERE id = @id`
);

const restoreItemStatement = db.prepare(
  `UPDATE planner_items
   SET completed = 0,
       archived_at = NULL,
       archived_reason = NULL
   WHERE id = ?`
);

const deleteItemStatement = db.prepare(
  "DELETE FROM planner_items WHERE id = ?"
);

const insertEvent = db.prepare(
  `INSERT INTO planner_events (planner_item_id, event_type, metadata)
   VALUES (@planner_item_id, @event_type, @metadata)`
);

const recordEvent = (id: number, eventType: EventType, metadata: Record<string, unknown> = {}) => {
  try {
    insertEvent.run({
      planner_item_id: id,
      event_type: eventType,
      metadata: JSON.stringify(metadata),
    });
  } catch (error) {
    console.error("Failed to record planner event", error);
  }
};

async function fetchAllPages(url: string): Promise<CanvasTodo[]> {
  if (!CANVAS_TOKEN) {
    throw new Error("Canvas token not configured");
  }

  const results: CanvasTodo[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${CANVAS_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Canvas error ${response.status}: ${body}`);
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      data.forEach((entry) => {
        results.push(entry as CanvasTodo);
      });
    }

    const linkHeader = response.headers.get("link");
    if (linkHeader) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = match ? match[1] : null;
    } else {
      nextUrl = null;
    }
  }

  return results;
}

async function syncCanvasAssignments() {
  if (!CANVAS_TOKEN) {
    return;
  }

  const todos = await fetchAllPages(`${BASE_URL}/users/self/todo?per_page=100`);

  for (const todo of todos) {
    const assignment = todo?.assignment;
    if (!assignment || assignment.locked_for_user) {
      continue;
    }

    const externalId = assignment.id;

    const dueAt = assignment.due_at || null;
    const createdAt = assignment.created_at || new Date().toISOString();

    const existing = selectItemByOrigin.get("canvas", externalId) as PlannerRow | undefined;

    const derivedTime = (() => {
      if (!dueAt) return null;
      const parsed = new Date(dueAt);
      if (Number.isNaN(parsed.getTime())) return null;
      const hours = String(parsed.getHours()).padStart(2, "0");
      const minutes = String(parsed.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    })();

    if (!existing) {
      insertCanvasItem.run({
        external_id: externalId,
        title: assignment.name,
        due_at: dueAt,
        scheduled_time: derivedTime,
        created_at: createdAt,
      });
      continue;
    }

    if (existing.archived_reason) {
      continue;
    }

    updateCanvasItem.run({
      id: existing.id,
      title: assignment.name,
      due_at: dueAt,
      scheduled_time: derivedTime,
      created_at: createdAt,
    });
  }
}

app.get("/api/planner", async (req, res) => {
  try {
    if (req.query.sync === "true") {
      try {
        await syncCanvasAssignments();
      } catch (error) {
        console.error("Failed to sync Canvas assignments", error);
      }
    }

    res.json(getPlannerState());
  } catch (error) {
    console.error("Failed to load planner state", error);
    res.status(500).json({ error: "Failed to load planner state" });
  }
});

app.post("/api/planner/manual", (req, res) => {
  try {
    const { text, due_at: dueAt, scheduled_time: scheduledTime } = req.body ?? {};

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Manual tasks require text" });
      return;
    }

    const createdAt = new Date().toISOString();

    insertManualItem.run({
      title: text.trim(),
      due_at: dueAt || null,
      scheduled_time: scheduledTime || null,
      created_at: createdAt,
    });

    res.json(getPlannerState());
  } catch (error) {
    console.error("Failed to create manual task", error);
    res.status(500).json({ error: "Failed to create manual task" });
  }
});

app.post("/api/planner/:id/archive", (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const { reason } = req.body ?? {};

    if (!id || (reason !== "completed" && reason !== "deleted")) {
      res.status(400).json({ error: "Invalid archive request" });
      return;
    }

    const archivedAt = new Date().toISOString();
    const result = archiveItemStatement.run({
      id,
      reason,
      archived_at: archivedAt,
    });

    if (result.changes === 0) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    recordEvent(id, reason, { archived_at: archivedAt });

    res.json(getPlannerState());
  } catch (error) {
    console.error("Failed to archive task", error);
    res.status(500).json({ error: "Failed to archive task" });
  }
});

app.post("/api/planner/:id/restore", (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!id) {
      res.status(400).json({ error: "Invalid restore request" });
      return;
    }

    const result = restoreItemStatement.run(id);

    if (result.changes === 0) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    recordEvent(id, "restored");

    res.json(getPlannerState());
  } catch (error) {
    console.error("Failed to restore task", error);
    res.status(500).json({ error: "Failed to restore task" });
  }
});

app.delete("/api/planner/:id", (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!id) {
      res.status(400).json({ error: "Invalid delete request" });
      return;
    }

    const result = deleteItemStatement.run(id);

    if (result.changes === 0) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(getPlannerState());
  } catch (error) {
    console.error("Failed to remove task", error);
    res.status(500).json({ error: "Failed to remove task" });
  }
});

app.get("/api/todos", async (_req, res) => {
  try {
    if (!CANVAS_TOKEN) {
      res.status(500).json({
        error: "CANVAS_TOKEN not configured",
      });
      return;
    }

    const todos = await fetchAllPages(`${BASE_URL}/users/self/todo?per_page=100`);

    const filtered = todos.filter((todo) => {
      const assignment = todo.assignment;
      return !(assignment && assignment.locked_for_user);
    });

    filtered.sort((a, b) => {
      const aDue = a.assignment?.due_at;
      const bDue = b.assignment?.due_at;

      if (!aDue && !bDue) return 0;
      if (!aDue) return 1;
      if (!bDue) return -1;

      return new Date(aDue).getTime() - new Date(bDue).getTime();
    });

    res.json(filtered);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Proxy error:", message);
    res.status(500).json({
      error: "Failed to fetch from Canvas",
      detail: message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Planner API running on http://localhost:${PORT}`);
});
