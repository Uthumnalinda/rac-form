# Rotaract UWU – Event Attendance Form

Custom, mobile-first event attendance form for the **Rotaract Club of Uva Wellassa University – Badulla**.
Designed to handle **500+ simultaneous submissions** using 100% free services and batch-sync them into Google Sheets.

## Project Structure

- [index.html](index.html), [styles.css](styles.css), [src/main.ts](src/main.ts) — Custom attendance form in TypeScript (collects **Full Name**, **Enrollment Number**, and **Contact Number**).
- [assets/logo.png](assets/logo.png) — Club logo.
- [cloudflare-worker/](cloudflare-worker/) — TypeScript Cloudflare Worker + D1 SQLite database to buffer high-concurrency submissions.
- [google-apps-script/Code.gs](google-apps-script/Code.gs) — Scheduled Google Apps Script that batch-syncs new rows into Google Sheets.

---

## Setup Guide (100% Free)

### 0. Build the TypeScript Frontend
```bash
npm install
npm run build
```
*(This compiles `src/main.ts` into `dist/main.js`.)*

### 1. Deploy the Cloudflare Worker & D1 Database
1. Install Wrangler: `npm install -g wrangler` and log in: `wrangler login`.
2. Create the D1 database inside `cloudflare-worker/`:
   ```bash
   cd cloudflare-worker
   wrangler d1 create rac-attendance
   ```
3. Copy the `database_id` from the output into `cloudflare-worker/wrangler.toml`.
4. Create the table:
   ```bash
   wrangler d1 execute rac-attendance --remote --file=schema.sql
   ```
5. Set a secret key for Google Sheets sync:
   ```bash
   wrangler secret put SYNC_SECRET
   ```
6. Deploy the worker:
   ```bash
   wrangler deploy
   ```

### 2. Connect the Form Frontend
1. Open `src/main.ts` and set `CONFIG.ENDPOINT_URL` to your Worker's `/submit` URL:
   ```ts
   ENDPOINT_URL: "https://rac-form-api.<your-subdomain>.workers.dev/submit",
   ```
2. Optionally update `CONFIG.EVENT_NAME` for each event, then run `npm run build`.
3. Host the root folder on **GitHub Pages** or **Cloudflare Pages** (free).

### 3. Connect Your Google Sheet
1. Open your target Google Sheet → **Extensions → Apps Script**.
2. Paste the contents of `google-apps-script/Code.gs`.
3. Update `WORKER_BASE_URL` and `SYNC_SECRET` to match your Worker.
4. Run `syncSubmissions` once manually to grant permissions.
5. In Apps Script **Triggers** (clock icon), add a **Time-driven** trigger for `syncSubmissions` every **1 minute** (or **5 minutes**).
