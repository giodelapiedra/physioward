import { query } from '../db/pool';

export interface UserRow {
  id:            string;
  email:         string;
  password_hash: string;
  role:          string;
  created_at:    Date;
  updated_at:    Date;
}

export const userRepository = {
  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await query<UserRow>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );
    return rows[0] ?? null;
  },

  async findById(id: string | number): Promise<UserRow | null> {
    const { rows } = await query<UserRow>('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return rows[0] ?? null;
  },

  async create(email: string, passwordHash: string, role = 'CEO'): Promise<UserRow> {
    const { rows } = await query<UserRow>(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email, passwordHash, role]
    );
    return rows[0];
  },

  async updatePassword(id: string | number, passwordHash: string): Promise<void> {
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, id]
    );
  },
};
