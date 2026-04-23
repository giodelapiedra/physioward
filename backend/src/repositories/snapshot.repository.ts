import { query } from '../db/pool';
import { MonthlyDashboard } from '../types';

interface SnapshotRow {
  id:         string;
  clinic_id:  string;
  year:       number;
  month:      number;
  payload:    MonthlyDashboard;
  fetched_at: Date;
}

export const snapshotRepository = {
  async find(clinicId: string, year: number, month: number): Promise<SnapshotRow | null> {
    const { rows } = await query<SnapshotRow>(
      `SELECT * FROM dashboard_snapshots
       WHERE clinic_id = $1 AND year = $2 AND month = $3
       LIMIT 1`,
      [clinicId, year, month]
    );
    return rows[0] ?? null;
  },

  async upsert(
    clinicId: string,
    year: number,
    month: number,
    payload: MonthlyDashboard
  ): Promise<SnapshotRow> {
    const { rows } = await query<SnapshotRow>(
      `INSERT INTO dashboard_snapshots (clinic_id, year, month, payload, fetched_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (clinic_id, year, month)
       DO UPDATE SET payload = EXCLUDED.payload,
                     fetched_at = EXCLUDED.fetched_at
       RETURNING *`,
      [clinicId, year, month, JSON.stringify(payload)]
    );
    return rows[0];
  },
};
