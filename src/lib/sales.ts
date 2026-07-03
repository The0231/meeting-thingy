// Server-side access to sales history. Reads the SalesSnapshot rows (populated
// from Power BI or seeded for demos) and turns them into per-client
// sales-health alerts. Kept separate from the pure detector in
// ./sales-health.ts so that stays I/O-free and testable.

import { config } from "./config";
import { prisma } from "./db";
import {
  detectSalesAlerts,
  type MonthlySales,
  type SalesAlert,
} from "./sales-health";

function parseCategories(json: string | null): Record<string, number> | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Every client's monthly sales, keyed by clientId (oldest → newest). */
export async function getMonthlySalesByClient(): Promise<
  Map<string, MonthlySales[]>
> {
  const byClient = new Map<string, MonthlySales[]>();
  let rows: {
    clientId: string;
    periodStart: Date;
    revenue: number;
    units: number | null;
    categories: string | null;
  }[];
  try {
    rows = await prisma.salesSnapshot.findMany({
      orderBy: { periodStart: "asc" },
      select: {
        clientId: true,
        periodStart: true,
        revenue: true,
        units: true,
        categories: true,
      },
    });
  } catch {
    // Table may not exist yet (before `prisma db push`). Degrade to "no data".
    return byClient;
  }

  for (const r of rows) {
    const arr = byClient.get(r.clientId) ?? [];
    arr.push({
      periodStart: r.periodStart,
      revenue: r.revenue,
      units: r.units,
      categories: parseCategories(r.categories),
    });
    byClient.set(r.clientId, arr);
  }
  return byClient;
}

/**
 * Sales-health alerts per client (only clients with at least one alert appear
 * in the map). Returns an empty map when there's no sales history at all, so
 * callers can treat "no Power BI / no data" as simply "no alerts".
 */
export async function getSalesAlertsByClient(): Promise<Map<string, SalesAlert[]>> {
  const salesByClient = await getMonthlySalesByClient();
  const out = new Map<string, SalesAlert[]>();
  if (salesByClient.size === 0) return out;

  const opts = {
    dropThreshold: config.sales.dropThreshold,
    stoppedMonths: config.sales.stoppedMonths,
  };
  for (const [clientId, sales] of salesByClient) {
    const alerts = detectSalesAlerts(sales, opts);
    if (alerts.length) out.set(clientId, alerts);
  }
  return out;
}
