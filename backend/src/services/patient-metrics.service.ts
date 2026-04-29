import { V3Appointment } from './nookal-v3/queries';
import { fetchAppointmentsInRange } from './nookal-v3/fetchers';
import { NookalDataCache } from './nookal-v3/data-cache';
import { Clinic } from '../types';

/**
 * New Patients + Patient Reactivations. Counts native Nookal flags
 * `isNewClient` / `isNewCase` on appointments in the clinic+range,
 * matching Nookal's Providers and Practice "Consultations & Classes"
 * totals exactly.
 *
 * Reactivations = New Cases − New Patients (Sam's manual formula).
 */

export interface PatientMetricsReport {
  clinicId:             string;
  clinicName:           string;
  dateFrom:             string;
  dateTo:               string;
  newPatients:          number;
  newCaseCount:         number;
  patientReactivations: number;
  uniqueClients:        number;
  completedConsults:    number;
  didNotArrive:         number;
}

/**
 * Nookal returns `appointmentDate` already as YYYY-MM-DD (unlike entry.date
 * which is a full "Fri Jan 31 2025 …" string). No parsing needed.
 */
function apptDay(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

async function loadAppointments(
  clinic:   Clinic,
  dateFrom: string,
  dateTo:   string,
  cache?:   NookalDataCache
): Promise<V3Appointment[]> {
  if (cache) return cache.appointments(clinic.v3LocationId);
  return fetchAppointmentsInRange(clinic.v3LocationId, dateFrom, dateTo);
}

export const patientMetricsService = {
  async getReport(
    clinic:   Clinic,
    dateFrom: string,
    dateTo:   string,
    cache?:   NookalDataCache
  ): Promise<PatientMetricsReport> {
    const all = await loadAppointments(clinic, dateFrom, dateTo, cache);

    let newPatients  = 0;
    let newCaseCount = 0;
    // "Unique Clients" in Nookal's Consultations & Classes.
    // Statuses that count as a Service (Nookal's "Services" column):
    //   Completed  → provider marked done (past weeks)
    //   StdAppt    → scheduled, not yet marked (today / future weeks)
    //   Unpaid     → completed but invoice not yet paid (past weeks variant)
    //   Cancelled, DNA, Event, Note, Class → excluded
    // Nookal's Total row = sum of per-provider distinct clientIDs, NOT global
    // distinct (a client seen by two providers in the same week counts twice).
    // The `arrived` field is unreliable (mostly 0/null) — don't filter on it.
    const SERVICE_STATUSES = new Set(['Completed', 'StdAppt', 'Unpaid']);
    const clientsByProvider = new Map<number, Set<number>>();
    let completedConsults = 0;
    let didNotArrive      = 0;
    for (const a of all) {
      const day = apptDay(a.appointmentDate);
      if (!day || day < dateFrom || day > dateTo) continue;
      if (a.isNewClient) newPatients++;
      if (a.isNewCase)   newCaseCount++;
      // "Completed Consults" column in Nookal = count of status="Completed"
      // appointments (Unpaid and StdAppt are in Services but NOT here).
      if (a.status === 'Completed') completedConsults++;
      // "Did Not Arrive" in Nookal's Cancellations report =
      //   `dna === 1` AND `status !== "Cancelled"`.
      // The dna flag is sticky: if someone was DNA'd and then later had
      // their appointment cancelled, status becomes "Cancelled" but the
      // flag remains 1 — Nookal treats that as a cancellation, not DNA.
      // A DNA that stays DNA, or one that gets reclassified to Completed
      // (e.g. client came late), still counts.
      if (a.dna === 1 && a.status !== 'Cancelled') didNotArrive++;
      if (!a.providerID || !a.clientID) continue;
      if (!a.status || !SERVICE_STATUSES.has(a.status)) continue;
      let set = clientsByProvider.get(a.providerID);
      if (!set) clientsByProvider.set(a.providerID, set = new Set());
      set.add(a.clientID);
    }
    let uniqueClients = 0;
    for (const s of clientsByProvider.values()) uniqueClients += s.size;

    return {
      clinicId:   clinic.id,
      clinicName: clinic.name,
      dateFrom, dateTo,
      newPatients,
      newCaseCount,
      patientReactivations: newCaseCount - newPatients,
      uniqueClients,
      completedConsults,
      didNotArrive,
    };
  },
};
