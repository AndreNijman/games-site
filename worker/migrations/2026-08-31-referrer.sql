-- Where a browser said it came from, so "how did this device find the site"
-- is answerable from the console instead of from zone analytics.
--
-- Two columns because they answer different questions. first_referrer is the
-- arrival and never changes once set; referrer is the most recent external
-- one. Only cross-site referrers are stored: every game is a
-- *.andrenijman.com host, so an internal referrer would otherwise overwrite
-- the arrival on the very next click.
--
-- Referrer-Policy is strict-origin-when-cross-origin, so a cross-site value
-- arrives as a bare origin with no path. Existing rows stay empty; the column
-- cannot be backfilled because the header was never recorded.

ALTER TABLE devices ADD COLUMN first_referrer TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN referrer TEXT NOT NULL DEFAULT '';
