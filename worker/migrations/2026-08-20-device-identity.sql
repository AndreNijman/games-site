-- Richer device identification for the access console.
-- Passive columns come from request headers / Cloudflare; client_* columns are
-- reported once by /_guard/device-profile; label_source records whether the
-- label is a generated fingerprint, a self-chosen name, or an admin name.

ALTER TABLE devices ADD COLUMN model TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN os_version TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN browser_version TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN arch TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN asn_org TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN region TEXT NOT NULL DEFAULT '';

ALTER TABLE devices ADD COLUMN gpu TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN screen TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN cpu_cores INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN device_memory INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN touch_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN timezone TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN languages TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN profile_at TEXT;

ALTER TABLE devices ADD COLUMN label_source TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE devices ADD COLUMN named_at TEXT;
ALTER TABLE devices ADD COLUMN name_asked_at TEXT;

-- Existing rows were labelled either by the guest skip form, by the admin, or
-- automatically. They cannot be told apart retroactively, so they keep 'auto'
-- and will be re-asked once; a self or admin name then locks the label.
