const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function isAuthorized(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return env.SYNC_SECRET && auth === `Bearer ${env.SYNC_SECRET}`;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Public endpoint: receive form submissions (handles 500+ concurrent writes via D1)
    if (url.pathname === "/submit" && request.method === "POST") {
      try {
        const body = await request.json();
        const eventName = String(body.eventName || "Event Attendance").trim();
        const fullName = String(body.fullName || "").trim();
        const enrollmentNumber = String(body.enrollmentNumber || "").trim();
        const contactNumber = String(body.contactNumber || "").trim();
        const submittedAt = String(body.submittedAt || new Date().toISOString());

        if (!fullName || !enrollmentNumber || !contactNumber) {
          return jsonResponse({ error: "All fields are required." }, 400);
        }

        await env.DB.prepare(
          `INSERT INTO submissions (event_name, full_name, enrollment_number, contact_number, submitted_at, synced)
           VALUES (?, ?, ?, ?, ?, 0)`
        )
          .bind(eventName, fullName, enrollmentNumber, contactNumber, submittedAt)
          .run();

        return jsonResponse({ ok: true }, 201);
      } catch (err) {
        return jsonResponse({ error: "Invalid request or server error." }, 500);
      }
    }

    // Protected endpoint: Google Apps Script fetches unsynced rows in batches
    if (url.pathname === "/unsynced" && request.method === "GET") {
      if (!isAuthorized(request, env)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const { results } = await env.DB.prepare(
        `SELECT id, event_name, full_name, enrollment_number, contact_number, submitted_at
         FROM submissions
         WHERE synced = 0
         ORDER BY id ASC
         LIMIT 200`
      ).all();

      return jsonResponse({ rows: results || [] });
    }

    // Protected endpoint: Google Apps Script marks synced rows
    if (url.pathname === "/mark-synced" && request.method === "POST") {
      if (!isAuthorized(request, env)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const body = await request.json();
      const ids = Array.isArray(body.ids) ? body.ids.filter((n) => Number.isInteger(n)) : [];

      if (ids.length > 0) {
        const placeholders = ids.map(() => "?").join(",");
        await env.DB.prepare(`UPDATE submissions SET synced = 1 WHERE id IN (${placeholders})`)
          .bind(...ids)
          .run();
      }

      return jsonResponse({ ok: true, updated: ids.length });
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};

