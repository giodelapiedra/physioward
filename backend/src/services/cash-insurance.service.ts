import { nookalV3 } from './nookal-v3/client';
import {
  ENTRIES_BY_DATE_QUERY,
  INVOICES_BY_ID_QUERY,
  EntriesByDateResult,
  InvoicesByIDResult,
  V3InvoiceEntry,
  V3InvoiceStub,
  PAGE_LENGTH,
} from './nookal-v3/queries';
import { Clinic } from '../types';

/**
 * "Cash from Insurance" / "Third Party" report.
 *
 * Matches Nookal's Reports → Providers and Practice report when the "Third
 * Party" filter is applied. The filter is: invoice.isThirdPartyInvoice == 1.
 *
 * Aggregation mirrors the Revenue Report: entries are grouped into
 * Services / Inventory buckets and aggregated with subtotal + GST + total.
 *
 * Verified 2026-04-22: Newport 13-17 Apr 2026 returns $7,105.60 services,
 * matching the Nookal UI exactly.
 */

export interface CategoryTotal {
  subtotal: number;
  gst:      number;
  total:    number;
}

export interface CashFromInsuranceReport {
  clinicId:   string;
  clinicName: string;
  dateFrom:   string;
  dateTo:     string;
  services:   CategoryTotal;
  inventory:  CategoryTotal;
  other:      CategoryTotal;
  grand:      CategoryTotal;
  entryCount: number;
}

// ── helpers (mirror revenue.service) ──────────────────────────────

const MONTH_NUM: Record<string, number> = {
  Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12,
};
const pad2 = (n: number) => String(n).padStart(2, '0');

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function invoiceDayISO(nookalDate: string | null | undefined): string | null {
  if (!nookalDate) return null;
  const m = nookalDate.match(/^\w{3}\s+(\w{3})\s+(\d{2})\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTH_NUM[m[1]];
  if (!mon) return null;
  return `${m[3]}-${pad2(mon)}-${m[2]}`;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

function bucketFor(itemType: string | null | undefined): 'services' | 'inventory' | 'other' {
  const t = (itemType ?? '').toLowerCase();
  if (t.includes('consult') || t.includes('service') || t.includes('treatment')) return 'services';
  if (t.includes('stock') || t.includes('product') || t.includes('inventory')) return 'inventory';
  return 'other';
}

function addInto(target: CategoryTotal, entry: V3InvoiceEntry): void {
  target.subtotal += num(entry.subtotal);
  target.gst      += num(entry.tax);
  target.total    += num(entry.total);
}

const emptyBucket = (): CategoryTotal => ({ subtotal: 0, gst: 0, total: 0 });
const roundBucket = (b: CategoryTotal): CategoryTotal => ({
  subtotal: round2(b.subtotal), gst: round2(b.gst), total: round2(b.total),
});

async function fetchAllEntriesWide(dateFrom: string, dateTo: string): Promise<V3InvoiceEntry[]> {
  const nookalFrom = addDays(dateFrom, -7);
  const nookalTo   = addDays(dateTo,   +7);

  const all: V3InvoiceEntry[] = [];
  for (let page = 1; page < 200; page++) {
    const { invoiceEntry } = await nookalV3.query<EntriesByDateResult>(
      ENTRIES_BY_DATE_QUERY,
      { dateFrom: nookalFrom, dateTo: nookalTo, page, pageLength: PAGE_LENGTH }
    );
    if (!invoiceEntry?.length) break;
    all.push(...invoiceEntry);
    if (invoiceEntry.length < PAGE_LENGTH) break;
  }
  return all;
}

async function buildInvoiceMap(invoiceIds: number[]): Promise<Map<number, V3InvoiceStub>> {
  const map = new Map<number, V3InvoiceStub>();
  if (!invoiceIds.length) return map;

  for (let i = 0; i < invoiceIds.length; i += PAGE_LENGTH) {
    const chunk = invoiceIds.slice(i, i + PAGE_LENGTH);
    const [active, voided] = await Promise.all([
      nookalV3.query<InvoicesByIDResult>(INVOICES_BY_ID_QUERY,
        { invoiceIDs: chunk, void: 0, page: 1, pageLength: PAGE_LENGTH }),
      nookalV3.query<InvoicesByIDResult>(INVOICES_BY_ID_QUERY,
        { invoiceIDs: chunk, void: 1, page: 1, pageLength: PAGE_LENGTH }),
    ]);
    for (const inv of active.invoices ?? [])  map.set(inv.invoiceID, inv);
    for (const inv of voided.invoices ?? [])  map.set(inv.invoiceID, inv);
  }
  return map;
}

// ── Public API ────────────────────────────────────────────────────

export const cashInsuranceService = {
  async getReport(
    clinic:   Clinic,
    dateFrom: string,
    dateTo:   string
  ): Promise<CashFromInsuranceReport> {
    const targetLocation = clinic.v3LocationId;
    const entries = await fetchAllEntriesWide(dateFrom, dateTo);
    const invoiceMap = await buildInvoiceMap([...new Set(entries.map((e) => e.invoiceID))]);

    const services  = emptyBucket();
    const inventory = emptyBucket();
    const other     = emptyBucket();
    const grand     = emptyBucket();
    let entryCount = 0;

    for (const entry of entries) {
      if (entry.void) continue;
      const inv = invoiceMap.get(entry.invoiceID);
      if (!inv) continue;
      if (inv.locationID !== targetLocation) continue;
      if (inv.isThirdPartyInvoice !== 1) continue;
      // Mirror Nookal's "Active Provider" filter: it looks at the ENTRY's
      // own providerID (not the invoice's practitionerID). Invoice-level
      // practitioner can be set while individual entries (merchant fees,
      // admin charges within the same invoice) have null providerID — and
      // Nookal excludes those.
      if (!entry.providerID || entry.providerID === 0) continue;

      // Filter strictly by entry.date — the Providers and Practice report
      // does NOT use the after-midnight fallback that the Revenue Report
      // does. Verified across Feb 2025, Feb 2026, Apr 2026 samples.
      const entryDay = invoiceDayISO(entry.date);
      if (!entryDay || entryDay < dateFrom || entryDay > dateTo) continue;

      entryCount++;
      const b = bucketFor(entry.itemType);
      const bucket = b === 'services' ? services : b === 'inventory' ? inventory : other;
      addInto(bucket, entry);
      addInto(grand,  entry);
    }

    return {
      clinicId:   clinic.id,
      clinicName: clinic.name,
      dateFrom,
      dateTo,
      services:  roundBucket(services),
      inventory: roundBucket(inventory),
      other:     roundBucket(other),
      grand:     roundBucket(grand),
      entryCount,
    };
  },
};
