-- 003_patient_dropouts.sql
-- Daily Patient Dropout Tracking — manual entries by clinicians / front-desk.
-- Aggregated read-only by ADMIN per clinic and overall.

CREATE TABLE IF NOT EXISTS patient_dropouts (
  id                          BIGSERIAL PRIMARY KEY,
  clinic_id                   TEXT      NOT NULL,
  entered_by                  BIGINT    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  front_staff_id              BIGINT             REFERENCES users(id) ON DELETE SET NULL,
  clinician_id                BIGINT    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  patient_name                TEXT      NOT NULL,
  date_logged                 DATE      NOT NULL,
  appointment_cancelled_date  DATE,
  status                      TEXT      NOT NULL,
  reason                      TEXT      NOT NULL,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by                  BIGINT             REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT dropouts_status_check CHECK (status IN (
    'Re-scheduled',
    'Cancelled - not rescheduled',
    'No Future Bookings',
    'Completed Treatment Plan'
  )),
  CONSTRAINT dropouts_reason_check CHECK (reason IN (
    'Family',
    'Work Commitments',
    'Other',
    'Away',
    'Discharged',
    'Self Discharge'
  ))
);

CREATE INDEX IF NOT EXISTS dropouts_clinic_date_idx  ON patient_dropouts (clinic_id, date_logged DESC);
CREATE INDEX IF NOT EXISTS dropouts_entered_by_idx   ON patient_dropouts (entered_by);
CREATE INDEX IF NOT EXISTS dropouts_clinician_id_idx ON patient_dropouts (clinician_id);
