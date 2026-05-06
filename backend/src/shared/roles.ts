export const ROLES = {
  ADMIN:             'ADMIN',
  CLINICIAN:         'CLINICIAN',
  FRONT_DESK:        'FRONT_DESK',
  // Multi-clinic receptionist: cross-clinic data entry for dropouts and
  // case acceptance. clinic_id is NULL and picked per entry.
  FRONT_DESK_GLOBAL: 'FRONT_DESK_GLOBAL',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const ROLE_VALUES: readonly Role[] =
  Object.values(ROLES) as readonly Role[];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_VALUES as readonly string[]).includes(value);
}

// Clinics that staff can be scoped to. Mirrors backend/src/types CLINICS.
export const CLINIC_IDS = ['newport', 'narrabeen', 'brookvale'] as const;
export type ClinicId = typeof CLINIC_IDS[number];

export function isClinicId(value: unknown): value is ClinicId {
  return typeof value === 'string' && (CLINIC_IDS as readonly string[]).includes(value);
}

// Status / reason vocabularies for dropouts — mirror DB CHECK constraints.
export const DROPOUT_STATUSES = [
  'Re-scheduled',
  'Cancelled - not rescheduled',
  'No Future Bookings',
  'Completed Treatment Plan',
] as const;
export type DropoutStatus = typeof DROPOUT_STATUSES[number];

// Fixed list of front-of-staff names that can be tagged on a dropout entry.
// These are NOT user accounts — receptionists and physios who handle calls
// are recorded by name only. "Other - Physio" covers the case where a clinician
// (any clinician) took the call themselves.
export const FRONT_STAFF_NAMES = [
  'Tanya',
  'Bella',
  'Sandra',
  'AM',
  'Jenny',
  'Teresa',
  'Ben',
  'Other - Physio',
  'Carolyn',
  'Vanessa',
  'Holly',
  'Tilly',
] as const;
export type FrontStaffName = typeof FRONT_STAFF_NAMES[number];

export function isFrontStaffName(value: unknown): value is FrontStaffName {
  return typeof value === 'string' && (FRONT_STAFF_NAMES as readonly string[]).includes(value);
}

export const DROPOUT_REASONS = [
  'Sick',
  'Away',
  'Work Commitments',
  'Family',
  'Financial',
  'Other',
  'Discharged',
  'Early Discharge',
  'Self Discharge',
] as const;
export type DropoutReason = typeof DROPOUT_REASONS[number];
