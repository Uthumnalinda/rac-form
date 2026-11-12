/**
 * Google Apps Script — Batch Sync from Cloudflare Worker (D1) to Google Sheets.
 * Set a Time-driven Trigger (e.g. every 1 or 5 minutes) to run `syncSubmissions`.
 */

const WORKER_BASE_URL = "https://rac-form-api.rac-uwu.workers.dev";
const SYNC_SECRET = "YOUR_SYNC_SECRET";
const SHEET_NAME = "Attendance";

function syncSubmissions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["ID", "Timestamp", "Event Name", "Full Name", "Enrollment Number", "Contact Number", "NIC Number"]);
  }

  const res = UrlFetchApp.fetch(`${WORKER_BASE_URL}/unsynced`, {
    method: "get",
    headers: { Authorization: `Bearer ${SYNC_SECRET}` },
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() !== 200) {
    throw new Error(`Failed to fetch unsynced rows: ${res.getContentText()}`);
  }

  const data = JSON.parse(res.getContentText());
  const rows = data.rows || [];
  if (rows.length === 0) return;

  const values = rows.map((r) => [
    r.id,
    r.submitted_at,
    r.event_name,
    r.full_name,
    r.enrollment_number,
    r.contact_number,
    r.nic_number || "",
  ]);

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, values.length, values[0].length).setValues(values);

  const ids = rows.map((r) => r.id);
  UrlFetchApp.fetch(`${WORKER_BASE_URL}/mark-synced`, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${SYNC_SECRET}` },
    payload: JSON.stringify({ ids }),
  });
}
