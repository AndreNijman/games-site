PRAGMA foreign_keys = ON;

-- Daily page-view counters, one row per day per host. Days are bucketed in
-- Perth local time (UTC+8, no DST) so "today" matches the operator's day.
CREATE TABLE IF NOT EXISTS visit_days (
  day TEXT NOT NULL,
  host TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, host)
);

-- One row per device per day per host, so unique visitors can be counted
-- without storing a full event log.
CREATE TABLE IF NOT EXISTS visit_device_days (
  day TEXT NOT NULL,
  host TEXT NOT NULL,
  device_id TEXT NOT NULL,
  PRIMARY KEY (day, host, device_id)
);

CREATE INDEX IF NOT EXISTS visit_days_day ON visit_days (day);
CREATE INDEX IF NOT EXISTS visit_device_days_day ON visit_device_days (day);
