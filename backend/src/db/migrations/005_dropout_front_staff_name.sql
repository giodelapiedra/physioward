-- 005_dropout_front_staff_name.sql
-- Front-of-staff is a fixed list of names from the source spreadsheet
-- (Tanya, Bella, Sandra, AM, Jenny, Teresa, Ben, Other - Physio,
--  Carolyn, Vanessa, Holly), NOT a user account.
--
-- Replace front_staff_id (FK → users) with front_staff_name (TEXT). Backfill
-- from users.full_name where the existing FK row's name happens to match the
-- fixed list, so we don't lose data that was already in the table.

ALTER TABLE patient_dropouts
  ADD COLUMN IF NOT EXISTS front_staff_name TEXT;

-- Backfill: if front_staff_id pointed at a user whose full_name is in the
-- allowed list, copy that name across. Otherwise leave NULL.
UPDATE patient_dropouts d
   SET front_staff_name = u.full_name
  FROM users u
 WHERE d.front_staff_name IS NULL
   AND d.front_staff_id   IS NOT NULL
   AND d.front_staff_id   = u.id
   AND u.full_name IN (
     'Tanya','Bella','Sandra','AM','Jenny','Teresa','Ben',
     'Other - Physio','Carolyn','Vanessa','Holly'
   );

-- Now safe to drop the FK column.
ALTER TABLE patient_dropouts
  DROP COLUMN IF EXISTS front_staff_id;
