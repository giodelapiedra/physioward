import { env } from '../config/env';
import { pool } from './pool';
import { userRepository } from '../repositories/user.repository';
import { authService } from '../services/auth.service';

/**
 * Seed the initial CEO user from env vars. Idempotent — if the user already
 * exists, the password is NOT touched (so password changes happen in-app).
 */
export async function seedInitialUser(): Promise<void> {
  const existing = await userRepository.findByEmail(env.CEO_EMAIL);
  if (existing) {
    console.log(`[db] user ${env.CEO_EMAIL} already exists — skipping seed`);
    return;
  }

  const hash = await authService.hashPassword(env.CEO_PASSWORD);
  await userRepository.create({
    email:        env.CEO_EMAIL,
    passwordHash: hash,
    role:         'ADMIN',
    full_name:    env.CEO_EMAIL.split('@')[0],
    clinic_id:    null,
  });
  console.log(`[db] seeded ADMIN user: ${env.CEO_EMAIL}`);
}

if (require.main === module) {
  seedInitialUser()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db] seed failed:', err);
      process.exit(1);
    });
}
