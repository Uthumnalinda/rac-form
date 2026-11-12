interface Env {
  DB: D1Database;
  SYNC_SECRET: string;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
}

interface SubmitBody {
  eventName?: string;
  fullName?: string;
  enrollmentNumber?: string;
  contactNumber?: string;
  nicNumber?: string;
  submittedAt?: string;
}

interface MarkSyncedBody {
  ids?: unknown[];
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization") || "";
  return Boolean(env.SYNC_SECRET) && auth === `Bearer ${env.SYNC_SECRET}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Public endpoint: receive form submissions (handles 500+ concurrent writes via D1)
    if (url.pathname === "/submit" && request.method === "POST") {
      try {
        const body = (await request.json()) as SubmitBody;
        const eventName = String(body.eventName || "14th Installation Ceremony of Rotaract Club of Uva Wellassa University- Badulla").trim();
        const fullName = String(body.fullName || "").trim();
        const enrollmentNumber = String(body.enrollmentNumber || "").trim();
        const contactNumber = String(body.contactNumber || "").trim();
        const nicNumber = String(body.nicNumber || "").trim();
        const submittedAt = String(body.submittedAt || new Date().toISOString());

        if (!fullName || !enrollmentNumber || !contactNumber || !nicNumber) {
          return jsonResponse({ error: "All fields are required." }, 400);
        }

        // Check if an attendee with this Enrollment No or NIC is already registered
        const normalizedEnrollment = enrollmentNumber.toUpperCase();
        const normalizedNic = nicNumber.toUpperCase();

        const existing = await env.DB.prepare(
          `SELECT enrollment_number, nic_number FROM submissions
           WHERE UPPER(enrollment_number) = ? OR UPPER(nic_number) = ?
           LIMIT 1`
        )
          .bind(normalizedEnrollment, normalizedNic)
          .all<{ enrollment_number: string; nic_number: string }>();

        if (existing.results && existing.results.length > 0) {
          const match = existing.results[0];
          let message = "You have already registered for this ceremony.";
          if (match.enrollment_number.toUpperCase() === normalizedEnrollment && match.nic_number.toUpperCase() === normalizedNic) {
            message = "This Enrollment Number and NIC are already registered.";
          } else if (match.enrollment_number.toUpperCase() === normalizedEnrollment) {
            message = "This Enrollment Number is already registered.";
          } else {
            message = "This NIC Number is already registered.";
          }
          return jsonResponse({ error: message, duplicate: true }, 409);
        }

        await env.DB.prepare(
          `INSERT INTO submissions (event_name, full_name, enrollment_number, contact_number, nic_number, submitted_at, synced)
           VALUES (?, ?, ?, ?, ?, ?, 0)`
        )
          .bind(eventName, fullName, normalizedEnrollment, contactNumber, normalizedNic, submittedAt)
          .run();

        return jsonResponse({ ok: true }, 201);
      } catch {
        return jsonResponse({ error: "Invalid request or server error." }, 500);
      }
    }

    // Protected endpoint: Google Apps Script fetches unsynced rows in batches
    if (url.pathname === "/unsynced" && request.method === "GET") {
      if (!isAuthorized(request, env)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const { results } = await env.DB.prepare(
        `SELECT id, event_name, full_name, enrollment_number, contact_number, nic_number, submitted_at
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

      const body = (await request.json()) as MarkSyncedBody;
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((n): n is number => Number.isInteger(n))
        : [];

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
