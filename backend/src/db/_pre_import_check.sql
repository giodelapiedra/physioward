-- Run this on Ubuntu BEFORE the case-acceptance import.
-- Idempotent: safe to run multiple times.

\echo '=== existing case_acceptance rows per clinic ==='
SELECT clinic_id, COUNT(*) FROM case_acceptances GROUP BY clinic_id ORDER BY clinic_id;

\echo ''
\echo '=== existing CLINICIAN users (before rename) ==='
SELECT id, full_name, email, clinic_id FROM users
  WHERE role = 'CLINICIAN' AND is_active = true
  ORDER BY clinic_id, full_name;

\echo ''
\echo '=== rename Gabby -> Gabriella (if exists) ==='
UPDATE users SET full_name = 'Gabriella'
  WHERE full_name = 'Gabby' AND role = 'CLINICIAN' AND clinic_id = 'newport'
  RETURNING id, full_name, email;

\echo ''
\echo '=== CLINICIAN users AFTER rename ==='
SELECT id, full_name, email, clinic_id FROM users
  WHERE role = 'CLINICIAN' AND is_active = true
  ORDER BY clinic_id, full_name;
