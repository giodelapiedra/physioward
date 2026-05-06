-- 007_case_acceptance.sql
-- Daily Case Recommendation & Acceptance Tracker — manual entries by
-- clinicians / front-desk. Mirrors the source spreadsheet column-for-column.
-- ADMIN reads aggregated per-clinic and overall.

CREATE TABLE IF NOT EXISTS case_acceptances (
  id                          BIGSERIAL PRIMARY KEY,
  clinic_id                   TEXT      NOT NULL,
  entered_by                  BIGINT    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- Free-form name from the fixed FRONT_STAFF_NAMES list (not a user FK), same
  -- pattern as patient_dropouts.front_staff_name.
  front_staff_name            TEXT,
  clinician_id                BIGINT    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  patient_name                TEXT      NOT NULL,
  date_logged                 DATE      NOT NULL,

  -- Y/N from the spreadsheet. Nullable so partial entries are allowed
  -- (matches "Matthew Holmes"-style rows where the cell was left blank).
  treatment_plan_provided     BOOLEAN,

  case_recommendations        INTEGER   NOT NULL DEFAULT 0,
  appointments_booked         INTEGER   NOT NULL DEFAULT 0,

  -- "X" mark in the source sheet → true (offered / accepted). NULL = blank.
  prepay_offered              BOOLEAN,
  prepay_accepted             BOOLEAN,

  -- Green-shaded cell in the source sheet → patient transitioned (TP
  -- explained and objections handled successfully). NULL = blank.
  transition_completed        BOOLEAN,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by                  BIGINT             REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT case_acc_recs_nonneg    CHECK (case_recommendations >= 0),
  CONSTRAINT case_acc_booked_nonneg  CHECK (appointments_booked >= 0),
  -- Booked appointments cannot exceed the recommendation count — case
  -- acceptance % is meaningless otherwise.
  CONSTRAINT case_acc_booked_le_recs CHECK (appointments_booked <= case_recommendations)
);

CREATE INDEX IF NOT EXISTS case_acc_clinic_date_idx  ON case_acceptances (clinic_id, date_logged DESC);
CREATE INDEX IF NOT EXISTS case_acc_entered_by_idx   ON case_acceptances (entered_by);
CREATE INDEX IF NOT EXISTS case_acc_clinician_id_idx ON case_acceptances (clinician_id);
