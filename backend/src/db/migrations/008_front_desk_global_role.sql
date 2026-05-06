-- 008_front_desk_global_role.sql
-- New role: FRONT_DESK_GLOBAL — a "general" front-of-staff account that
-- inputs Patient Dropouts and Case Acceptance entries across ALL clinics
-- (one receptionist covering Newport / Narrabeen / Brookvale).
--
-- Scoping rules:
--   ADMIN              → clinic_id IS NULL (cross-clinic, no data entry)
--   FRONT_DESK_GLOBAL  → clinic_id IS NULL (cross-clinic, picks clinic per entry)
--   CLINICIAN          → clinic_id NOT NULL (own entries / own clinic)
--   FRONT_DESK         → clinic_id NOT NULL (pinned to a single clinic)

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('ADMIN', 'CLINICIAN', 'FRONT_DESK', 'FRONT_DESK_GLOBAL'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_clinic_scope_check;
ALTER TABLE users
  ADD CONSTRAINT users_clinic_scope_check
  CHECK (
    (role IN ('ADMIN', 'FRONT_DESK_GLOBAL') AND clinic_id IS NULL) OR
    (role IN ('CLINICIAN', 'FRONT_DESK')    AND clinic_id IS NOT NULL)
  );
