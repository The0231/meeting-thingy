// ============================================================================
// Sales-health signals.
//
// Turns a client's monthly sales history (from Power BI — see src/lib/sales.ts)
// into plain-English "something's up, go and see them" alerts:
//
//   volume_drop      — they're still ordering, but a lot less than they were.
//   stopped_ordering — they've gone quiet after a run of regular orders.
//   product_shift    — they've dropped a line they used to buy, or swung hard
//                      onto something new.
//
// These are the signals a rep would otherwise only notice by eyeballing a
// report. Feeding them into the visit suggestions means a client who quietly
// halves their order gets a catch-up visit booked even if their normal visit
// rhythm says they're not due yet.
//
// Pure functions only — no I/O, "today" is injectable — so it's easy to test.
// ============================================================================

export type SalesAlertType = "volume_drop" | "stopped_ordering" | "product_shift";

export interface SalesAlert {
  type: SalesAlertType;
  /** high = clearly worth a visit now; medium = keep an eye on it. */
  severity: "high" | "medium";
  /** Short headline for a badge, e.g. "Ordering down 42%". */
  title: string;
  /** One-sentence explanation for the rep. */
  detail: string;
  /** Signed magnitude where it makes sense (e.g. -0.42 for a 42% fall). */
  metric: number | null;
}

export interface MonthlySales {
  /** First day of the month (local midnight). */
  periodStart: Date;
  revenue: number;
  units: number | null;
  /** Per-category spend for the month, or null when the feed has no breakdown. */
  categories: Record<string, number> | null;
}

export interface SalesHealthOptions {
  /** Fractional fall that counts as a volume drop (0.3 = down 30%). */
  dropThreshold?: number;
  /** Consecutive recent zero-order months that count as "stopped". */
  stoppedMonths?: number;
  /** Months either side used to compare "recent" vs "before". */
  windowMonths?: number;
  /** Category must be at least this share of spend to matter (0.2 = 20%). */
  categoryShareThreshold?: number;
  /** "Now" — injectable for testing. Defaults to current date. */
  today?: Date;
}

const DEFAULTS: Required<Omit<SalesHealthOptions, "today">> = {
  dropThreshold: 0.3,
  stoppedMonths: 2,
  windowMonths: 3,
  categoryShareThreshold: 0.2,
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Whole months from `b` to `a` (a later than b → positive). */
function monthsBetween(a: Date, b: Date): number {
  return (
    (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth())
  );
}

/**
 * Expand sparse snapshots into a gap-free month-by-month series spanning the
 * OBSERVED range (first → last snapshot month). Interior gaps become genuine
 * zeros. We deliberately stop at the last observed month rather than padding to
 * "today": the current calendar month is usually incomplete, and a client who
 * has genuinely gone quiet is caught by the staleness check instead — so we
 * never mistake a part-way-through month for a real fall in orders.
 */
function densify(sales: MonthlySales[]): MonthlySales[] {
  if (sales.length === 0) return [];
  const byMonth = new Map<string, MonthlySales>();
  for (const s of sales) byMonth.set(monthKey(monthStart(s.periodStart)), s);

  const sorted = [...sales].sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
  );
  const start = monthStart(sorted[0].periodStart);
  const end = monthStart(sorted[sorted.length - 1].periodStart);

  const out: MonthlySales[] = [];
  for (let m = new Date(start); m <= end; m = addMonths(m, 1)) {
    const hit = byMonth.get(monthKey(m));
    out.push(
      hit
        ? { ...hit, periodStart: new Date(m) }
        : { periodStart: new Date(m), revenue: 0, units: null, categories: null },
    );
  }
  return out;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function avg(nums: number[]): number {
  return nums.length ? sum(nums) / nums.length : 0;
}

/** Aggregate per-category spend across a set of months. */
function categoryTotals(months: MonthlySales[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const m of months) {
    if (!m.categories) continue;
    for (const [cat, val] of Object.entries(m.categories)) {
      totals[cat] = (totals[cat] ?? 0) + val;
    }
  }
  return totals;
}

function pct(n: number): string {
  return `${Math.round(Math.abs(n) * 100)}%`;
}

/**
 * Detect sales-health alerts from a client's monthly history. Returns the most
 * important issues first; an empty array means "nothing to flag".
 */
export function detectSalesAlerts(
  sales: MonthlySales[],
  options: SalesHealthOptions = {},
): SalesAlert[] {
  const o = { ...DEFAULTS, ...options };
  const today = monthStart(options.today ?? new Date());
  const series = densify(sales);

  // Need a little history before any signal is trustworthy.
  const monthsWithOrders = series.filter((m) => m.revenue > 0).length;
  if (series.length < 3 || monthsWithOrders < 2) return [];

  const alerts: SalesAlert[] = [];

  // ---- Stopped ordering ----------------------------------------------------
  // How long since their last month with any orders? Measured against "today",
  // so a client whose sales simply vanish from the feed is caught even though
  // their observed history just stops.
  const lastOrder = [...series].reverse().find((m) => m.revenue > 0) ?? null;
  const quietMonths = lastOrder
    ? monthsBetween(today, monthStart(lastOrder.periodStart))
    : 0;

  let stopped = false;
  if (lastOrder && quietMonths >= o.stoppedMonths) {
    stopped = true;
    alerts.push({
      type: "stopped_ordering",
      severity: quietMonths >= o.stoppedMonths + 1 ? "high" : "medium",
      title: `No orders in ${quietMonths} months`,
      detail: `They used to order regularly but haven't for ${quietMonths} month${
        quietMonths === 1 ? "" : "s"
      } — worth a visit to find out what changed.`,
      metric: -1,
    });
  }

  // ---- Volume drop ---------------------------------------------------------
  // Compare the most recent window against the window before it. Skip when
  // they've stopped entirely (that's already the stronger "stopped" signal).
  if (!stopped && series.length >= o.windowMonths * 2) {
    const recent = series.slice(-o.windowMonths);
    const prior = series.slice(-o.windowMonths * 2, -o.windowMonths);
    const recentAvg = avg(recent.map((m) => m.revenue));
    const priorAvg = avg(prior.map((m) => m.revenue));

    if (priorAvg > 0) {
      const change = (recentAvg - priorAvg) / priorAvg; // negative = fell
      if (change <= -o.dropThreshold) {
        alerts.push({
          type: "volume_drop",
          severity: change <= -0.5 ? "high" : "medium",
          title: `Ordering down ${pct(change)}`,
          detail: `Their recent orders are down ${pct(
            change,
          )} on the previous few months — a good moment to check in and understand why.`,
          metric: change,
        });
      }
    }
  }

  // ---- Product shift -------------------------------------------------------
  // Compare category mix recent vs prior. Flag a previously-meaningful line
  // that's collapsed, or a newly-dominant line that wasn't there before.
  if (!stopped && series.length >= o.windowMonths * 2) {
    const recent = series.slice(-o.windowMonths);
    const prior = series.slice(-o.windowMonths * 2, -o.windowMonths);
    const recentCats = categoryTotals(recent);
    const priorCats = categoryTotals(prior);
    const recentTotal = sum(Object.values(recentCats));
    const priorTotal = sum(Object.values(priorCats));

    if (recentTotal > 0 && priorTotal > 0) {
      const cats = new Set([
        ...Object.keys(recentCats),
        ...Object.keys(priorCats),
      ]);
      let dropped: { cat: string; priorShare: number } | null = null;
      let added: { cat: string; recentShare: number } | null = null;

      for (const cat of cats) {
        const rShare = (recentCats[cat] ?? 0) / recentTotal;
        const pShare = (priorCats[cat] ?? 0) / priorTotal;
        // A line they used to buy that's essentially gone.
        if (
          pShare >= o.categoryShareThreshold &&
          rShare < o.categoryShareThreshold / 2 &&
          (!dropped || pShare > dropped.priorShare)
        ) {
          dropped = { cat, priorShare: pShare };
        }
        // Something new that's now a big part of what they buy.
        if (
          rShare >= o.categoryShareThreshold + 0.05 &&
          pShare < o.categoryShareThreshold / 2 &&
          (!added || rShare > added.recentShare)
        ) {
          added = { cat, recentShare: rShare };
        }
      }

      if (dropped) {
        alerts.push({
          type: "product_shift",
          severity: "medium",
          title: `Stopped buying ${dropped.cat}`,
          detail: `${dropped.cat} used to be ${pct(
            dropped.priorShare,
          )} of their order and has now dropped off — worth asking whether they've switched supplier for it.`,
          metric: -dropped.priorShare,
        });
      } else if (added) {
        alerts.push({
          type: "product_shift",
          severity: "medium",
          title: `Now mostly ${added.cat}`,
          detail: `Their order has shifted heavily onto ${added.cat} (${pct(
            added.recentShare,
          )} of recent spend) — a chance to make sure the rest of the range still fits.`,
          metric: added.recentShare,
        });
      }
    }
  }

  const rank = { high: 0, medium: 1 } as const;
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
