-- 004_dropout_reasons_extended.sql
-- Add new reasons sourced from the live tracking sheet:
--   Sick, Financial, Early Discharge
-- Existing rows keep their values; only the CHECK whitelist is widened.

ALTER TABLE patient_dropouts DROP CONSTRAINT IF EXISTS dropouts_reason_check;

ALTER TABLE patient_dropouts
  ADD CONSTRAINT dropouts_reason_check CHECK (reason IN (
    'Sick',
    'Away',
    'Work Commitments',
    'Family',
    'Financial',
    'Other',
    'Discharged',
    'Early Discharge',
    'Self Discharge'
  ));
