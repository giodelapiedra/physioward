-- 006_dropout_status_reason_nullable.sql
-- Legacy import (the 2026 tracking sheet) contains rows where Status and/or
-- Reason were left blank by staff. We faithfully preserve those as NULL
-- rather than defaulting/skipping them.
--
-- The CHECK constraints on status/reason stay in place: SQL CHECK passes on
-- NULL by default, so the whitelist still applies to any non-null value.
-- The frontend entry form continues to require both fields (zod), so this
-- only widens the schema for legacy / imported data.

ALTER TABLE patient_dropouts ALTER COLUMN status DROP NOT NULL;
ALTER TABLE patient_dropouts ALTER COLUMN reason DROP NOT NULL;
