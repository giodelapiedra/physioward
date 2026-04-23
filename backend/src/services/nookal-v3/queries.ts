/**
 * GraphQL queries — field names verified via live introspection 2026-04-22.
 *
 * Nookal's Revenue Report UI filters by ENTRY service date (when the service
 * was delivered), not invoice creation date. So we fetch entries by date
 * range, then resolve each entry's parent invoice to get the locationID.
 *
 * Nookal silently caps `pageLength` at 200 — page until a result is < 200.
 */

export const PAGE_LENGTH = 200;

// Fetch entries by service-delivery date. No locationID arg available at
// this level — we filter afterwards via the invoice lookup.
export const ENTRIES_BY_DATE_QUERY = /* GraphQL */ `
  query EntriesByDate($dateFrom: String!, $dateTo: String!, $page: Int!, $pageLength: Int!) {
    invoiceEntry(
      dateFrom:   $dateFrom,
      dateTo:     $dateTo,
      page:       $page,
      pageLength: $pageLength
    ) {
      entryID
      invoiceID
      itemType
      name
      ItemCode
      qty
      subtotal
      tax
      total
      void
      date
      providerID
    }
  }
`;

// Lookup invoices by ID (batched) to get locationID per entry's parent.
// Nookal's `invoices` query defaults to `void: 0` (non-voided only) and there
// is no "both" switch — we have to make two calls with void=0 and void=1 and
// merge, because Nookal's Revenue Report UI *includes* voided invoices.
export const INVOICES_BY_ID_QUERY = /* GraphQL */ `
  query InvoicesByID($invoiceIDs: [Int], $void: Int, $page: Int!, $pageLength: Int!) {
    invoices(
      invoiceIDs: $invoiceIDs,
      void:       $void,
      page:       $page,
      pageLength: $pageLength
    ) {
      invoiceID
      locationID
      isThirdPartyInvoice
      practitionerID
      void
      dateCreated
    }
  }
`;

export interface V3InvoiceEntry {
  entryID:    number;
  invoiceID:  number;
  itemType:   string;    // e.g. "Consultation", "Stock"
  name:       string;
  ItemCode:   string | null;
  qty:        number;
  subtotal:   number;
  tax:        number;
  total:      number;
  void:       number;
  date:       string;
  providerID: number | null;  // nullable — admin/fee entries have no provider
}

export interface V3InvoiceStub {
  invoiceID:             number;
  locationID:            number;
  isThirdPartyInvoice:   number;
  practitionerID:        number | null;
  void:                  number;
  dateCreated:           string;    // "Fri Jan 31 2025 10:00:00 GMT+1000 ..."
}

export interface EntriesByDateResult {
  invoiceEntry: V3InvoiceEntry[];
}

export interface InvoicesByIDResult {
  invoices: V3InvoiceStub[];
}

// Payments by date range (date = payment receipt date).
// Nookal v3 pageLength silently capped at 200.
export const PAYMENTS_BY_DATE_QUERY = /* GraphQL */ `
  query PaymentsByDate($dateFrom: String!, $dateTo: String!, $page: Int!, $pageLength: Int!) {
    payments(
      dateFrom:   $dateFrom,
      dateTo:     $dateTo,
      page:       $page,
      pageLength: $pageLength
    ) {
      paymentID
      locationID
      method
      amount
      date
      active
      invoiceID
      clientID
    }
  }
`;

export interface V3Payment {
  paymentID:  number;
  locationID: number;
  method:     string | null;
  amount:     number;
  date:       string;
  active:     number;
  invoiceID:  number;
  clientID:   number;
}

export interface PaymentsByDateResult {
  payments: V3Payment[];
}
