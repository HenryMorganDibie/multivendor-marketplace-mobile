/**
 * Responsive layout tokens for invoice rendering.
 *
 * Every invoice template should derive its padding, section spacing, and
 * typography rhythm from these values so the document feels intentional on
 * phones, tablets, desktop web, and printed/PDF output.
 *
 * Layout is driven by the *container* width, not the device type. A web
 * browser can be narrow; a tablet can be wide; orientation can change.
 */

export const INVOICE_BREAKPOINTS = {
  /** Compact/mobile layout threshold. Below this, metadata stacks and tables
   * become compact rows. */
  COMPACT: 520,
  /** Medium/tablet threshold. Two-column metadata, full tables where room
   * allows. */
  MEDIUM: 760,
  /** Wide/desktop threshold. Generous padding, full document tables. */
  WIDE: 900,
  /** Maximum width of the rendered document on large screens. The invoice
   * should never stretch across a full desktop browser window. */
  MAX_PAGE_WIDTH: 860,
  /** Fixed width used for print/PDF output. Independent of the screen layout. */
  PRINT_WIDTH: 612,
} as const;

export interface InvoiceLayoutSpec {
  mode: 'compact' | 'medium' | 'wide';
  /** Internal page padding (left/right and top/bottom inside the document). */
  pagePadding: number;
  /** Space between major vertical sections (header → metadata → items, etc.). */
  sectionGap: number;
  /** Space between related blocks inside a section. */
  blockGap: number;
  /** Space between rows inside a block (e.g., address lines). */
  rowGap: number;
  /** Suggested width for the totals column on non-compact layouts. */
  totalsWidth: number;
  /** Compact mode flag for easy branching. */
  compact: boolean;
  /** Medium mode flag. */
  medium: boolean;
  /** Wide mode flag. */
  wide: boolean;
}

/**
 * Resolve the layout spec for a measured container width. A non-positive width
 * falls back to compact so the first render is safe before onLayout fires.
 */
export function resolveInvoiceLayout(containerWidth: number): InvoiceLayoutSpec {
  if (containerWidth <= 0) {
    return {
      mode: 'compact',
      pagePadding: 18,
      sectionGap: 18,
      blockGap: 12,
      rowGap: 8,
      totalsWidth: 220,
      compact: true,
      medium: false,
      wide: false,
    };
  }

  if (containerWidth < INVOICE_BREAKPOINTS.COMPACT) {
    return {
      mode: 'compact',
      pagePadding: 18,
      sectionGap: 18,
      blockGap: 12,
      rowGap: 8,
      totalsWidth: 220,
      compact: true,
      medium: false,
      wide: false,
    };
  }

  if (containerWidth < INVOICE_BREAKPOINTS.MEDIUM) {
    return {
      mode: 'medium',
      pagePadding: 26,
      sectionGap: 26,
      blockGap: 16,
      rowGap: 10,
      totalsWidth: 280,
      compact: false,
      medium: true,
      wide: false,
    };
  }

  return {
    mode: 'wide',
    pagePadding: 40,
    sectionGap: 32,
    blockGap: 20,
    rowGap: 12,
    totalsWidth: 320,
    compact: false,
    medium: false,
    wide: true,
  };
}

/** Print/PDF always uses a fixed wide-style layout with print-safe padding. */
export function resolvePrintInvoiceLayout(): InvoiceLayoutSpec {
  return {
    mode: 'wide',
    pagePadding: 40,
    sectionGap: 32,
    blockGap: 20,
    rowGap: 12,
    totalsWidth: 280,
    compact: false,
    medium: false,
    wide: true,
  };
}
