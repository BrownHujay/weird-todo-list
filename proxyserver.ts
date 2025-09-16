import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

// load .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL =
  process.env.CANVAS_API_URL || "https://nuevaschool.instructure.com/api/v1";

app.use(cors());

if (!process.env.CANVAS_TOKEN) {
  console.error("ERROR: CANVAS_TOKEN is not defined in .env file");
  process.exit(1);
}

/**
 * Helper to fetch all pages from Canvas API
 */
async function fetchAllPages(url: string) {
  let results: any[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const r = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${process.env.CANVAS_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!r.ok) {
      const errBody = await r.text();
      throw new Error(`Canvas error ${r.status}: ${errBody}`);
    }

    const data = await r.json();
    results = results.concat(data);

    // parse Link header for rel="next"
    const linkHeader = r.headers.get("link");
    if (linkHeader) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = match ? match[1] : null;
    } else {
      nextUrl = null;
    }
  }

  return results;
}

app.get("/api/todos", async (_req, res) => {
  try {
    const todos = await fetchAllPages(
      `${BASE_URL}/users/self/todo?per_page=100`
    );

    // Filter out locked assignments
    const filtered = todos.filter(todo => {
      const asn = todo.assignment;
      return !(asn && asn.locked_for_user);
    });

    filtered.sort((a, b) => {
      const aDue = a.assignment?.due_at;
      const bDue = b.assignment?.due_at;
    
      if (!aDue && !bDue) return 0;
      if (!aDue) return 1;
      if (!bDue) return -1;
    
      return new Date(aDue).getTime() - new Date(bDue).getTime(); // earliest → latest
    });
    

    res.json(filtered);
  } catch (err: any) {
    console.error("Proxy error:", err.message);
    res.status(500).json({
      error: "Failed to fetch from Canvas",
      detail: err.message,
    });
  }
});

app.listen(PORT, () =>
  console.log(`Express proxy running on http://localhost:${PORT}`)
);
