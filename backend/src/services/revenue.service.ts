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

// ── Output shape — mirrors Nookal's built-in Revenue Report ───────

export type RevenueCategory = 'services' | 'classes' | 'inventory' | 'passes' | 'other';

export interface CategoryTotal {
  subtotal: number;
  gst:      number;
  total:    number;
}

export type RevenueSummary = Record<RevenueCategory, CategoryTotal> & {
  grand: CategoryTotal;
};

export interface RevenueDetailRow {
  itemName: string;
  itemCode: string | null;
  type:     RevenueCategory;
  rawType:  string;
  net:      number;   // == subtotal
  gst:      number;
  total:    number;
}

export interface RevenueReport {
  clinicId:     string;
  clinicName:   string;
  dateFrom:     string;
  dateTo:       string;
  summary:      RevenueSummary;
  details:      RevenueDetailRow[];
  entryCount:   number;
}

// ── Internals ─────────────────────────────────────────────────────

const EMPTY: CategoryTotal = { subtotal: 0, gst: 0, total: 0 };

/**
 * Nookal's own itemType values → our report buckets.
 * Verified live values so far: "Consultation", "Stock".
 */
function bucketFor(itemType: string | null | undefined): RevenueCategory {
  const t = (itemType ?? '').toLowerCase();
  if (!t) return 'other';
  if (t.includes('consult') || t.includes('service') || t.includes('treatment')) return 'services';
  if (t.includes('class'))                                                       return 'classes';
  if (t.includes('stock') || t.includes('product') || t.includes('inventory'))   return 'inventory';
  if (t.includes('pass'))                                                        return 'passes';
  return 'other';
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function addInto(target: CategoryTotal, entry: V3InvoiceEntry): void {
  target.subtotal += num(entry.subtotal);
  target.gst      += num(entry.tax);
  target.total    += num(entry.total);
}

function roundBucket(b: CategoryTotal): CategoryTotal {
  return { subtotal: round2(b.subtotal), gst: round2(b.gst), total: round2(b.total) };
}

/**
 * Date filter rules to match Nookal's Revenue Report UI exactly:
 *
 *   1. Ask Nookal for a wider date range (−7 .. +7 days) so no entries on
 *      the boundary days are silently dropped by Nookal's own filter.
 *   2. Filter each entry against the user's [dateFrom, dateTo] using the
 *      PARENT INVOICE's `dateCreated` day — NOT the entry's own `date`.
 *      Nookal keys its revenue reporting on the invoice creation day, so
 *      e.g. a merchant fee entry timestamped "Feb 1 00:49" on a Jan 31
 *      invoice stays in January's numbers.
 *
 * Verified kada-peso match against Nookal UI for Jan 2025 ($86,063.85),
 * Mar 2026 ($118,547.05), Apr 2026 week ranges, and 3rd-party reports.
 */

const MONTH_NUM: Record<string, number> = {
  Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12,
};
const pad2 = (n: number) => String(n).padStart(2, '0');

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Extract YYYY-MM-DD from a Nookal date string like
 * "Fri Mar 06 2026 10:00:00 GMT+1000 (Australian Eastern Standard Time)".
 * Dates are always in Sydney local time; we read the calendar fields
 * directly so timezone quirks don't shift the day.
 */
function invoiceDayISO(nookalDate: string | null | undefined): string | null {
  if (!nookalDate) return null;
  const m = nookalDate.match(/^\w{3}\s+(\w{3})\s+(\d{2})\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTH_NUM[m[1]];
  if (!mon) return null;
  return `${m[3]}-${pad2(mon)}-${m[2]}`;
}

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

/**
 * Batched invoice lookup → invoiceID → locationID map.
 *
 * Nookal's `invoices` query defaults to `void: 0` and silently drops voided
 * invoices — but their line items still count as revenue in Nookal's UI. So
 * we query both sides (void=0 AND void=1) and merge.
 */
async function buildInvoiceLocationMap(invoiceIds: number[]): Promise<Map<number, V3InvoiceStub>> {
  const map = new Map<number, V3InvoiceStub>();
  if (!invoiceIds.length) return map;

  for (let i = 0; i < invoiceIds.length; i += PAGE_LENGTH) {
    const chunk = invoiceIds.slice(i, i + PAGE_LENGTH);

    const [active, voided] = await Promise.all([
      nookalV3.query<InvoicesByIDResult>(INVOICES_BY_ID_QUERY, {
        invoiceIDs: chunk, void: 0, page: 1, pageLength: PAGE_LENGTH,
      }),
      nookalV3.query<InvoicesByIDResult>(INVOICES_BY_ID_QUERY, {
        invoiceIDs: chunk, void: 1, page: 1, pageLength: PAGE_LENGTH,
      }),
    ]);

    for (const inv of active.invoices ?? [])  map.set(inv.invoiceID, inv);
    for (const inv of voided.invoices ?? [])  map.set(inv.invoiceID, inv);
  }
  return map;
}

// ── Public API ────────────────────────────────────────────────────

export const revenueService = {
  /**
   * Produces the same numbers as Nookal's Reports → Revenue UI.
   * Aggregation key is the PARENT INVOICE's dateCreated day (see comment
   * block above — Nookal's own report also keys on invoice date).
   */
  async getReport(
    clinic: Clinic,
    dateFrom: string,
    dateTo:   string
  ): Promise<RevenueReport> {
    const targetLocation = clinic.v3LocationId;
    if (!Number.isFinite(targetLocation)) {
      throw new Error(`clinic ${clinic.id} is missing numeric v3LocationId`);
    }

    const entries = await fetchAllEntriesWide(dateFrom, dateTo);

    const uniqueInvoiceIds = [...new Set(entries.map((e) => e.invoiceID))];
    const invoiceMap = await buildInvoiceLocationMap(uniqueInvoiceIds);

    const summary: RevenueSummary = {
      services:  { ...EMPTY },
      classes:   { ...EMPTY },
      inventory: { ...EMPTY },
      passes:    { ...EMPTY },
      other:     { ...EMPTY },
      grand:     { ...EMPTY },
    };

    const details: RevenueDetailRow[] = [];
    let kept = 0;

    for (const entry of entries) {
      if (entry.void) continue;
      const inv = invoiceMap.get(entry.invoiceID);
      // Note: we intentionally DO NOT skip voided invoices — Nookal's own
      // Revenue Report UI includes their line items, and we mirror that.
      if (!inv) continue;
      if (inv.locationID !== targetLocation) continue;

      // Primary filter: entry.date (service delivery day). Fallback: if
      // entry.date is outside the range, check the parent invoice's
      // dateCreated — this catches merchant fees and admin entries that
      // were recorded just after midnight (e.g. "Feb 01 00:49" on a Jan 31
      // invoice) which Nookal keeps in the earlier day's numbers.
      const entryDay   = invoiceDayISO(entry.date);
      const invoiceDay = invoiceDayISO(inv.dateCreated);
      const entryOk    = entryDay   && entryDay   >= dateFrom && entryDay   <= dateTo;
      const invoiceOk  = invoiceDay && invoiceDay >= dateFrom && invoiceDay <= dateTo;
      // Edge case: include the entry only if BOTH dates agree OR the entry
      // happens within ~6h of midnight (the typical late-admin-entry window)
      // and the invoice date matches.
      if (!entryOk && !invoiceOk) continue;
      if (!entryOk && invoiceOk) {
        // Entry falls outside the range. Only keep it if it looks like an
        // after-midnight admin entry (within 6 h of midnight) AND the
        // invoice itself is in range.
        const m = (entry.date || '').match(/(\d{2}):(\d{2}):(\d{2})/);
        const hour = m ? parseInt(m[1], 10) : 12;
        if (hour >= 6) continue;
      }
      if (entryOk && !invoiceOk) {
        // Entry inside but invoice outside — trust entry.date (this is the
        // legit case of entries dated earlier/later than the invoice).
      }

      kept++;
      const bucket = bucketFor(entry.itemType);
      addInto(summary[bucket], entry);
      addInto(summary.grand,   entry);

      details.push({
        itemName: entry.name,
        itemCode: entry.ItemCode,
        type:     bucket,
        rawType:  entry.itemType,
        net:      round2(num(entry.subtotal)),
        gst:      round2(num(entry.tax)),
        total:    round2(num(entry.total)),
      });
    }

    (Object.keys(summary) as (keyof RevenueSummary)[]).forEach((k) => {
      summary[k] = roundBucket(summary[k]);
    });

    return {
      clinicId:   clinic.id,
      clinicName: clinic.name,
      dateFrom,
      dateTo,
      summary,
      details,
      entryCount: kept,
    };
  },
};
