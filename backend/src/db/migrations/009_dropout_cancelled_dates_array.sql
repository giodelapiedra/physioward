-- 009_dropout_cancelled_dates_array.sql
-- A patient can cancel multiple appointments before being logged as a dropout.
-- Replace the single appointment_cancelled_date with a DATE[] array so we can
-- record all of them on a single dropout entry.
--
-- Idempotent: only does anything if the new column doesn't already exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_name  = 'patient_dropouts'
       AND column_name = 'appointment_cancelled_dates'
  ) THEN
    -- 1. Add the new column with empty-array default so existing rows stay valid.
    ALTER TABLE patient_dropouts
      ADD COLUMN appointment_cancelled_dates DATE[] NOT NULL DEFAULT '{}';

    -- 2. Backfill: if the legacy single date was set, promote it into a
    --    one-element array; otherwise leave the empty array default.
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_name  = 'patient_dropouts'
         AND column_name = 'appointment_cancelled_date'
    ) THEN
      UPDATE patient_dropouts
         SET appointment_cancelled_dates = ARRAY[appointment_cancelled_date]
       WHERE appointment_cancelled_date IS NOT NULL;

      ALTER TABLE patient_dropouts DROP COLUMN appointment_cancelled_date;
    END IF;
  END IF;
END $$;
