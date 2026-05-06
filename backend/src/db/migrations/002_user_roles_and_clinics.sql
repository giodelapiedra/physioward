-- 002_user_roles_and_clinics.sql
-- Extend users with role/clinic scoping for clinician + front-desk accounts.
-- Idempotent. Backward-compatible with the seeded CEO user.

-- 1. New columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Migrate the seeded CEO row to the new role taxonomy.
--    Role 'CEO' is replaced by 'ADMIN' (same person, cleaner naming).
UPDATE users
   SET role      = 'ADMIN',
       full_name = COALESCE(full_name, split_part(email, '@', 1))
 WHERE role = 'CEO';

-- 3. Lock down role values.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('ADMIN', 'CLINICIAN', 'FRONT_DESK'));

-- 4. Lock down clinic scoping:
--    ADMIN must have clinic_id IS NULL (sees all clinics).
--    CLINICIAN / FRONT_DESK must have clinic_id NOT NULL (scoped to one).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_clinic_scope_check;
ALTER TABLE users
  ADD CONSTRAINT users_clinic_scope_check
  CHECK (
    (role = 'ADMIN' AND clinic_id IS NULL) OR
    (role IN ('CLINICIAN', 'FRONT_DESK') AND clinic_id IS NOT NULL)
  );

-- 5. Lookup index for active users in a clinic (used by admin list + dropdowns).
CREATE INDEX IF NOT EXISTS users_clinic_role_idx
  ON users (clinic_id, role)
  WHERE is_active = TRUE;
