CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  enrollment_number TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  nic_number TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_submissions_synced ON submissions (synced, id);
