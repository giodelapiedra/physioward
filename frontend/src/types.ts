export interface WeekMetrics {
  weekNum: number | string;
  label: string;
  dateFrom: string;
  dateTo: string;
  totalRevenue: number;
  productSalesRevenue: number;
  upfrontRevenue: number;
  cashFromInsurance: number;
  debtCollection: number;
  newPatients: number;
  patientReactivations: number;
  newOptIns: number;
  totalPatients: number;
  appointmentsAttended: number;
  appointmentsCancelled: number;
  appointmentsRebooked: number;
  noShows: number;
  showUpRate: number | null;
  cancellationRate: number | null;
  caseAcceptance: number | null;
  upfrontPlanAccepted: number;
  productsUpsold: number;
  complementaryTransitions: number;
  activePatients: number;
}

export interface MonthlyTotals {
  totalRevenue: number;
  productSalesRevenue: number;
  upfrontRevenue: number;
  cashFromInsurance: number;
  debtCollection: number;
  newPatients: number;
  patientReactivations: number;
  newOptIns: number;
  totalPatients: number;
  appointmentsAttended: number;
  appointmentsCancelled: number;
  appointmentsRebooked: number;
  noShows: number;
  showUpRate: number | null;
  cancellationRate: number | null;
  caseAcceptance: number | null;
  upfrontPlanAccepted: number;
  productsUpsold: number;
  complementaryTransitions: number;
  activePatients: number;
}

export interface DashboardData {
  clinic: string;
  clinicId: string;
  month: number;
  year: number;
  weeks: WeekMetrics[];
  monthly: MonthlyTotals;
  fetchedAt: string;
  duration: number;
  fromCache?: boolean;
}

export interface User {
  email: string;
  role: string;
}
