import api from './client';
import { DashboardData } from '../types';

export const dashboardApi = {
  getClinics: () =>
    api.get('/api/dashboard/clinics').then(r => r.data),

  getMonthly: (
    clinic: string,
    month: number,
    year: number,
    opts?: { forceRefresh?: boolean }
  ): Promise<DashboardData> =>
    api
      .get('/api/dashboard/monthly', {
        params: { clinic, month, year, ...(opts?.forceRefresh && { refresh: 1 }) },
      })
      .then((r) => r.data),
};
