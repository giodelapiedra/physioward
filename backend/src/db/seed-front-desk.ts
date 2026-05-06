/**
 * Seed one FRONT_DESK_GLOBAL account per receptionist name in FRONT_STAFF_NAMES.
 *
 * Their `users.full_name` is the display name that gets stamped onto every
 * Patient Dropout / Case Acceptance entry they create — that's why the
 * names here must match the values in the source spreadsheet.
 *
 * Idempotent: if an account already exists at the generated email, it is
 * left untouched. Re-run safely after adding new names to FRONT_STAFF_NAMES.
 *
 * Run with:  npm run db:seed:front-desk
 */
import { pool } from './pool';
import { userRepository } from '../repositories/user.repository';
import { authService } from '../services/auth.service';
import { FRONT_STAFF_NAMES } from '../shared/roles';

const DEFAULT_PASSWORD = process.env.FRONT_DESK_DEFAULT_PASSWORD ?? 'ChangeMe123!';
const EMAIL_DOMAIN     = process.env.FRONT_DESK_EMAIL_DOMAIN     ?? 'physioward.com.au';

function emailFor(name: string): string {
  // "Other - Physio" → "other-physio", "AM" → "am". Strip anything that
  // isn't valid in the local-part of an email.
  const local = name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9.+_-]/g, '');
  return `${local}@${EMAIL_DOMAIN}`;
}

export async function seedFrontDeskUsers(): Promise<void> {
  // "Other - Physio" is a spreadsheet placeholder for any clinician who
  // happened to take the call — not a real receptionist, so we skip it.
  const names = FRONT_STAFF_NAMES.filter((n) => n !== 'Other - Physio');

  const created: { name: string; email: string }[] = [];
  const skipped: string[] = [];

  // Hash once — same default password for every new account.
  const passwordHash = await authService.hashPassword(DEFAULT_PASSWORD);

  for (const name of names) {
    const email = emailFor(name);

    const existing = await userRepository.findByEmail(email);
    if (existing) { skipped.push(email); continue; }

    await userRepository.create({
      email,
      passwordHash,
      role:      'FRONT_DESK_GLOBAL',
      full_name: name,
      clinic_id: null,
    });
    created.push({ name, email });
  }

  if (created.length) {
    console.log('\n✓ Created front-desk accounts:');
    for (const u of created) {
      console.log(`  - ${u.name.padEnd(18)} ${u.email}`);
    }
    console.log(`\n  Default password (all):  ${DEFAULT_PASSWORD}`);
    console.log('  Each user should change their password after first login.\n');
  } else {
    console.log('\n  No new accounts created.');
  }

  if (skipped.length) {
    console.log('⤴ Already existed (skipped):');
    for (const e of skipped) console.log(`  - ${e}`);
    console.log('');
  }
}

if (require.main === module) {
  seedFrontDeskUsers()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db] front-desk seed failed:', err);
      process.exit(1);
    });
}
