import { revenueService } from './revenue.service';
import { cashInsuranceService } from './cash-insurance.service';
import { calculateMonthlyTotals } from './kpi.calculator';
import { getWeekRanges, getMonthRange } from './week.calculator';
import { snapshotRepository } from '../repositories/snapshot.repository';
import { env } from '../config/env';
import { Clinic, MonthlyDashboard, WeekMetrics, WeekRange } from '../types';

export interface DashboardResult extends MonthlyDashboard {
  fetchedAt: string;
  fromCache: boolean;
  duration:  number;
}

function isFresh(fetchedAt: Date): boolean {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs < env.SNAPSHOT_TTL_MINUTES * 60 * 1000;
}

export const dashboardService = {
  async getMonthly(
    clinic: Clinic,
    year: number,
    month: number,
    forceRefresh: boolean
  ): Promise<DashboardResult> {
    const startedAt = Date.now();

    if (!forceRefresh) {
      const cached = await snapshotRepository.find(clinic.id, year, month);
      if (cached && isFresh(cached.fetched_at)) {
        return {
          ...cached.payload,
          fetchedAt: new Date(cached.fetched_at).toISOString(),
          fromCache: true,
          duration:  Date.now() - startedAt,
        };
      }
    }

    const payload = await fetchFromNookal(clinic, year, month);
    await snapshotRepository.upsert(clinic.id, year, month, payload);

    return {
      ...payload,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      duration:  Date.now() - startedAt,
    };
  },
};

/**
 * Build monthly dashboard from v3 GraphQL. Weeks are Mon-Fri work-weeks, so
 * summing them MISSES weekend revenue. For the "Monthly Actual" column we
 * fetch the full month (1..lastDay) in parallel and override the summed
 * totals. This keeps the weekly breakdown clean while the monthly total
 * matches Nookal's own month-range Revenue Report exactly.
 */
async function fetchFromNookal(
  clinic: Clinic,
  year: number,
  month: number
): Promise<MonthlyDashboard> {
  const weekRanges = getWeekRanges(year, month);
  const monthRange = getMonthRange(year, month);
  console.log(`[dashboard] v3: fetching ${clinic.name} ${month}/${year}`);

  const weeksPromise = Promise.all(
    weekRanges.map(async (week) => {
      console.log(`  -> ${week.label} (${week.dateFrom} .. ${week.dateTo})`);
      const [revenue, insurance] = await Promise.all([
        revenueService.getReport(clinic, week.dateFrom, week.dateTo),
        cashInsuranceService.getReport(clinic, week.dateFrom, week.dateTo),
      ]);
      return reportToWeekMetrics(week, revenue, insurance.grand.total);
    })
  );

  const monthlyRevenuePromise = revenueService.getReport(clinic, monthRange.dateFrom, monthRange.dateTo);
  const monthlyInsurancePromise = cashInsuranceService.getReport(clinic, monthRange.dateFrom, monthRange.dateTo);

  const [weekResults, monthlyRevenue, monthlyInsurance] = await Promise.all([
    weeksPromise, monthlyRevenuePromise, monthlyInsurancePromise,
  ]);

  const monthly = calculateMonthlyTotals(weekResults);
  // Override the sum-of-weeks values with the full-month figures so that
  // "Monthly Actual" matches Nookal's month-range Revenue Report exactly
  // (the sum of Mon-Fri weeks misses weekend activity).
  monthly.totalRevenue        = monthlyRevenue.summary.grand.total;
  monthly.productSalesRevenue = monthlyRevenue.summary.inventory.total;
  monthly.cashFromInsurance   = monthlyInsurance.grand.total;

  return {
    clinic:   clinic.name,
    clinicId: clinic.id,
    month,
    year,
    weeks:    weekResults,
    monthly,
  };
}

function reportToWeekMetrics(
  week: WeekRange,
  r:    Awaited<ReturnType<typeof revenueService.getReport>>,
  cashFromInsurance: number
): WeekMetrics {
  return {
    weekNum:  week.weekNum,
    label:    week.label,
    dateFrom: week.dateFrom,
    dateTo:   week.dateTo,

    // Finance — populated from the v3 revenue report (Nookal-parity)
    totalRevenue:        r.summary.grand.total,
    productSalesRevenue: r.summary.inventory.total,
    cashFromInsurance,

    // TODO: requires separate v3 queries
    upfrontRevenue:      0,
    debtCollection:      0,

    // TODO: needs v3 `clients` query
    newPatients:          0,
    patientReactivations: 0,
    newOptIns:            0,

    // TODO: needs v3 `appointments` query
    totalPatients:            0,
    appointmentsAttended:     0,
    appointmentsCancelled:    0,
    appointmentsRebooked:     0,
    noShows:                  0,
    showUpRate:               null,
    cancellationRate:         null,
    caseAcceptance:           null,
    upfrontPlanAccepted:      0,
    productsUpsold:           0,
    complementaryTransitions: 0,
    activePatients:           0,
  };
}
