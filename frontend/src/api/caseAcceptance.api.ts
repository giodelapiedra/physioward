import api from './client';
import { CaseAcceptanceDTO, ClinicId, FrontStaffName } from '../types';

export interface ListCaseAcceptanceFilters {
  clinic_id?:    ClinicId;
  date_from?:    string;
  date_to?:      string;
  clinician_id?: string;
  tp_provided?:  boolean;
  search?:       string;
  limit?:        number;
  offset?:       number;
}

export interface PagedCaseAcceptance {
  data: CaseAcceptanceDTO[];
  pagination: {
    limit:   number;
    offset:  number;
    total:   number;
    hasMore: boolean;
  };
}

export interface CreateCaseAcceptancePayload {
  clinic_id?:               ClinicId;
  front_staff_name?:        FrontStaffName | null;
  clinician_id:             string;
  patient_name:             string;
  date_logged:              string;
  treatment_plan_provided?: boolean | null;
  case_recommendations:     number;
  appointments_booked:      number;
  prepay_offered?:          boolean | null;
  prepay_accepted?:         boolean | null;
  transition_completed?:    boolean | null;
  notes?:                   string | null;
}

export interface UpdateCaseAcceptancePayload {
  front_staff_name?:        FrontStaffName | null;
  clinician_id?:            string;
  patient_name?:            string;
  date_logged?:             string;
  treatment_plan_provided?: boolean | null;
  case_recommendations?:    number;
  appointments_booked?:     number;
  prepay_offered?:          boolean | null;
  prepay_accepted?:         boolean | null;
  transition_completed?:    boolean | null;
  notes?:                   string | null;
}

export interface CaseAcceptanceSummary {
  total:                number;
  totalRecommendations: number;
  totalBooked:          number;
  caseAcceptancePct:    number | null;
  tpProvided:           number;
  tpNotProvided:        number;
  prepayOffered:        number;
  prepayAccepted:       number;
  transitions:          number;
  byClinic:             Record<string, number>;
}

export const caseAcceptanceApi = {
  list: (filters: ListCaseAcceptanceFilters = {}): Promise<PagedCaseAcceptance> =>
    api.get('/api/case-acceptance', { params: filters }).then(r => r.data),

  summary: (filters: Omit<ListCaseAcceptanceFilters, 'limit' | 'offset'> = {}): Promise<CaseAcceptanceSummary> =>
    api.get('/api/case-acceptance/summary', { params: filters }).then(r => r.data),

  create: (payload: CreateCaseAcceptancePayload): Promise<CaseAcceptanceDTO> =>
    api.post('/api/case-acceptance', payload).then(r => r.data),

  update: (id: string, patch: UpdateCaseAcceptancePayload): Promise<CaseAcceptanceDTO> =>
    api.patch(`/api/case-acceptance/${id}`, patch).then(r => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/api/case-acceptance/${id}`).then(() => {}),
};
