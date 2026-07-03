// ============================================================================
// Power BI integration.
//
// Pulls one row per client (name + yearly sales value) out of a Power BI
// dataset using the REST API's executeQueries endpoint, authenticated as an
// Azure AD service principal (see .env.example for the one-time Azure setup).
//
// The sync then fuzzy-matches each row to a client in our database:
//   - already linked (same powerBiName)            → value refreshed
//   - name similar enough (score ≥ AUTO_MATCH)     → linked automatically
//   - otherwise                                    → reported back with
//     suggestions so it can be linked by hand (or created) on the Power BI page.
// ============================================================================

import { config } from "./config";
import { prisma } from "./db";
import { rankMatches } from "./match";

export interface PowerBiRow {
  name: string;
  value: number | null;
  /** Account owner (sales rep) from Power BI, when POWERBI_REP_COLUMN is set. */
  rep: string | null;
}

export interface SyncSuggestion {
  clientId: string;
  clientName: string;
  score: number;
}

export interface SyncResult {
  rowsFetched: number;
  /** Rows linked to a client this run (auto or previously linked). */
  updated: { clientId: string; clientName: string; powerBiName: string; value: number | null }[];
  /** Rows we created new clients for (only when createMissing is on). */
  created: { clientId: string; clientName: string; value: number | null }[];
  /** Rows we couldn't confidently place, with the closest existing clients. */
  unmatched: { powerBiName: string; value: number | null; suggestions: SyncSuggestion[] }[];
}

// Similarity needed to link a Power BI row to a client without asking.
const AUTO_MATCH = 0.85;
// Anything above this is worth showing as a suggestion.
const SUGGEST_MIN = 0.5;

class PowerBiError extends Error {}

/** Client-credentials token for the Power BI REST API. */
async function getAccessToken(): Promise<string> {
  const p = config.powerbi;
  const res = await fetch(
    `https://login.microsoftonline.com/${p.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: p.clientId,
        client_secret: p.clientSecret,
        scope: "https://analysis.windows.net/powerbi/api/.default",
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new PowerBiError(
      `Couldn't sign in to Power BI (check tenant ID, client ID and secret). ${detail.slice(0, 300)}`,
    );
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new PowerBiError("Power BI sign-in returned no token.");
  return data.access_token;
}

/**
 * DAX that returns one row per client with the summed value aliased
 * [PBI_VALUE]. SUMMARIZECOLUMNS works for both a transactions table and a
 * one-row-per-client table.
 */
function buildDax(): string {
  const p = config.powerbi;
  if (p.daxQuery) return p.daxQuery;
  const t = p.table.replace(/'/g, "''");
  const rep = p.repColumn
    ? `, "PBI_REP", MAX('${t}'[${p.repColumn}])`
    : "";
  return `EVALUATE SUMMARIZECOLUMNS('${t}'[${p.nameColumn}], "PBI_VALUE", SUM('${t}'[${p.valueColumn}])${rep})`;
}

/** Run one DAX query against the configured dataset and return its rows. */
async function executeQueries(dax: string): Promise<Record<string, unknown>[]> {
  const p = config.powerbi;
  const token = await getAccessToken();
  const base = p.workspaceId
    ? `https://api.powerbi.com/v1.0/myorg/groups/${p.workspaceId}`
    : "https://api.powerbi.com/v1.0/myorg";
  const res = await fetch(`${base}/datasets/${p.datasetId}/executeQueries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      queries: [{ query: dax }],
      serializerSettings: { includeNulls: true },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new PowerBiError(
      `Power BI query failed (check workspace/dataset IDs, table & column names, and that the app has access to the workspace). ${detail.slice(0, 400)}`,
    );
  }
  const data = (await res.json()) as {
    results?: { tables?: { rows?: Record<string, unknown>[] }[] }[];
  };
  return data.results?.[0]?.tables?.[0]?.rows ?? [];
}

/** Fetch client name + value rows from the configured dataset. */
export async function fetchPowerBiRows(): Promise<PowerBiRow[]> {
  if (!config.powerbiEnabled) {
    throw new PowerBiError(
      "Power BI isn't configured yet — fill in the POWERBI_* values in .env (see .env.example).",
    );
  }
  const rows = await executeQueries(buildDax());

  // Row keys look like "Sales[Client]" and "[PBI_VALUE]" — pick the value by
  // its alias and treat the first other column as the client name.
  const out: PowerBiRow[] = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    const valueKey = keys.find((k) => k.toUpperCase().includes("PBI_VALUE"));
    const repKey = keys.find((k) => k.toUpperCase().includes("PBI_REP"));
    const nameKey = keys.find((k) => k !== valueKey && k !== repKey);
    if (!nameKey) continue;
    const rawName = row[nameKey];
    if (rawName == null || String(rawName).trim() === "") continue;
    const rawValue = valueKey ? row[valueKey] : null;
    const rawRep = repKey ? row[repKey] : null;
    out.push({
      name: String(rawName).trim(),
      value: typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : null,
      rep: rawRep != null && String(rawRep).trim() ? String(rawRep).trim() : null,
    });
  }
  return out;
}

/**
 * Sync Power BI rows into the client database. Idempotent — running it twice
 * changes nothing the second time.
 */
export async function syncPowerBi(options: { createMissing?: boolean } = {}): Promise<SyncResult> {
  const rows = await fetchPowerBiRows();
  const clients = await prisma.client.findMany({
    select: { id: true, clientName: true, businessName: true, powerBiName: true },
  });

  const now = new Date();
  const result: SyncResult = {
    rowsFetched: rows.length,
    updated: [],
    created: [],
    unmatched: [],
  };
  // Each client can absorb at most one row per run.
  const taken = new Set<string>();

  for (const row of rows) {
    // 1) Already linked to this exact Power BI row name.
    let target = clients.find((c) => c.powerBiName === row.name && !taken.has(c.id));

    // 2) Otherwise, best fuzzy match on client or business name.
    if (!target) {
      const candidates = clients.filter((c) => !taken.has(c.id));
      const ranked = rankMatches(
        row.name,
        candidates,
        (c) => c.clientName,
        SUGGEST_MIN,
      );
      const rankedBiz = rankMatches(
        row.name,
        candidates.filter((c) => c.businessName),
        (c) => c.businessName!,
        SUGGEST_MIN,
      );
      const best = [...ranked, ...rankedBiz].sort((a, b) => b.score - a.score)[0];
      if (best && best.score >= AUTO_MATCH) {
        target = best.candidate;
      } else {
        const suggestions = [...ranked, ...rankedBiz]
          .sort((a, b) => b.score - a.score)
          .filter(
            (m, i, arr) =>
              arr.findIndex((x) => x.candidate.id === m.candidate.id) === i,
          )
          .slice(0, 3)
          .map((m) => ({
            clientId: m.candidate.id,
            clientName: m.candidate.clientName,
            score: Math.round(m.score * 100) / 100,
          }));

        if (options.createMissing) {
          const created = await prisma.client.create({
            data: {
              clientName: row.name,
              annualValue: row.value,
              valueSource: row.value != null ? "powerbi" : null,
              powerBiName: row.name,
              powerBiSyncedAt: now,
              salesRep: row.rep,
            },
            select: { id: true },
          });
          result.created.push({
            clientId: created.id,
            clientName: row.name,
            value: row.value,
          });
        } else {
          result.unmatched.push({ powerBiName: row.name, value: row.value, suggestions });
        }
        continue;
      }
    }

    taken.add(target.id);
    await prisma.client.update({
      where: { id: target.id },
      data: {
        annualValue: row.value,
        valueSource: row.value != null ? "powerbi" : undefined,
        powerBiName: row.name,
        powerBiSyncedAt: now,
        salesRep: row.rep,
      },
    });
    result.updated.push({
      clientId: target.id,
      clientName: target.clientName,
      powerBiName: row.name,
      value: row.value,
    });
  }

  return result;
}

// ---- Sales history (month-by-month, for the sales-health alerts) -----------

export interface SalesHistoryRow {
  name: string;
  /** Any date within the period; rolled up to its calendar month. */
  period: Date;
  value: number;
  units: number | null;
  category: string | null;
}

export interface SalesHistorySyncResult {
  rowsFetched: number;
  clientsUpdated: number;
  snapshotsWritten: number;
}

/**
 * DAX returning per-client, per-date sales (optionally split by category and
 * with units). We group only by raw columns — no date-table dependency — and
 * roll the rows up to months in JS, so this works on almost any model. Supply
 * POWERBI_SALES_HISTORY_DAX to override with a pre-aggregated query.
 */
function buildSalesHistoryDax(): string {
  const p = config.powerbi;
  if (p.salesHistoryDax) return p.salesHistoryDax;
  const t = p.table.replace(/'/g, "''");
  const cat = p.categoryColumn
    ? `'${t}'[${p.categoryColumn}], `
    : "";
  const units = p.unitsColumn
    ? `, "PBI_UNITS", SUM('${t}'[${p.unitsColumn}])`
    : "";
  return `EVALUATE SUMMARIZECOLUMNS('${t}'[${p.nameColumn}], '${t}'[${p.dateColumn}], ${cat}"PBI_VALUE", SUM('${t}'[${p.valueColumn}])${units})`;
}

/** Fetch raw per-client, per-date sales rows from the configured dataset. */
export async function fetchSalesHistoryRows(): Promise<SalesHistoryRow[]> {
  if (!config.salesHistoryEnabled) {
    throw new PowerBiError(
      "Sales history isn't configured — set POWERBI_DATE_COLUMN (and optionally POWERBI_CATEGORY_COLUMN / POWERBI_UNITS_COLUMN) in .env.",
    );
  }
  const rows = await executeQueries(buildSalesHistoryDax());
  const out: SalesHistoryRow[] = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    const valueKey = keys.find((k) => k.toUpperCase().includes("PBI_VALUE"));
    const unitsKey = keys.find((k) => k.toUpperCase().includes("PBI_UNITS"));
    const dateKey = keys.find(
      (k) =>
        k !== valueKey &&
        k !== unitsKey &&
        config.powerbi.dateColumn &&
        k.includes(config.powerbi.dateColumn),
    );
    const catKey =
      config.powerbi.categoryColumn &&
      keys.find(
        (k) =>
          k !== valueKey &&
          k !== unitsKey &&
          k !== dateKey &&
          k.includes(config.powerbi.categoryColumn),
      );
    const nameKey = keys.find(
      (k) => k !== valueKey && k !== unitsKey && k !== dateKey && k !== catKey,
    );
    if (!nameKey || !dateKey) continue;

    const rawName = row[nameKey];
    if (rawName == null || String(rawName).trim() === "") continue;
    const period = new Date(String(row[dateKey]));
    if (isNaN(period.getTime())) continue;
    const rawValue = valueKey ? row[valueKey] : null;
    const rawUnits = unitsKey ? row[unitsKey] : null;
    const rawCat = catKey ? row[catKey] : null;

    out.push({
      name: String(rawName).trim(),
      period,
      value:
        typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : 0,
      units:
        typeof rawUnits === "number" && Number.isFinite(rawUnits) ? rawUnits : null,
      category: rawCat != null && String(rawCat).trim() ? String(rawCat).trim() : null,
    });
  }
  return out;
}

/**
 * Pull month-by-month sales from Power BI and upsert them into SalesSnapshot,
 * matched to existing clients by their linked Power BI name (or a confident
 * fuzzy name match). Idempotent — re-running refreshes the same months.
 */
export async function syncSalesSnapshots(): Promise<SalesHistorySyncResult> {
  const rows = await fetchSalesHistoryRows();
  const clients = await prisma.client.findMany({
    select: { id: true, clientName: true, businessName: true, powerBiName: true },
  });

  // Resolve each distinct Power BI name to a client id (cache the decision).
  const nameToClient = new Map<string, string | null>();
  function resolve(name: string): string | null {
    if (nameToClient.has(name)) return nameToClient.get(name)!;
    let id: string | null = null;
    const linked = clients.find((c) => c.powerBiName === name);
    if (linked) {
      id = linked.id;
    } else {
      const ranked = rankMatches(name, clients, (c) => c.clientName, AUTO_MATCH);
      const rankedBiz = rankMatches(
        name,
        clients.filter((c) => c.businessName),
        (c) => c.businessName!,
        AUTO_MATCH,
      );
      const best = [...ranked, ...rankedBiz].sort((a, b) => b.score - a.score)[0];
      if (best && best.score >= AUTO_MATCH) id = best.candidate.id;
    }
    nameToClient.set(name, id);
    return id;
  }

  // Roll rows up to one bucket per (client, month).
  interface Bucket {
    revenue: number;
    units: number | null;
    categories: Record<string, number>;
  }
  const buckets = new Map<string, { clientId: string; periodStart: Date; b: Bucket }>();
  for (const row of rows) {
    const clientId = resolve(row.name);
    if (!clientId) continue;
    const periodStart = new Date(row.period.getFullYear(), row.period.getMonth(), 1);
    const key = `${clientId}|${periodStart.getFullYear()}-${periodStart.getMonth()}`;
    const entry =
      buckets.get(key) ??
      { clientId, periodStart, b: { revenue: 0, units: null, categories: {} } };
    entry.b.revenue += row.value;
    if (row.units != null) entry.b.units = (entry.b.units ?? 0) + row.units;
    if (row.category) {
      entry.b.categories[row.category] =
        (entry.b.categories[row.category] ?? 0) + row.value;
    }
    buckets.set(key, entry);
  }

  const now = new Date();
  const touchedClients = new Set<string>();
  let snapshotsWritten = 0;
  for (const { clientId, periodStart, b } of buckets.values()) {
    const categories = Object.keys(b.categories).length
      ? JSON.stringify(b.categories)
      : null;
    await prisma.salesSnapshot.upsert({
      where: { clientId_periodStart: { clientId, periodStart } },
      create: {
        clientId,
        periodStart,
        revenue: b.revenue,
        units: b.units,
        categories,
        source: "powerbi",
        syncedAt: now,
      },
      update: { revenue: b.revenue, units: b.units, categories, source: "powerbi", syncedAt: now },
    });
    touchedClients.add(clientId);
    snapshotsWritten++;
  }

  return {
    rowsFetched: rows.length,
    clientsUpdated: touchedClients.size,
    snapshotsWritten,
  };
}

// Cache Power BI rows briefly so recording several meetings in a row doesn't
// hammer the API — freshness hardly matters for yearly client values.
let rowsCache: { rows: PowerBiRow[]; at: number } | null = null;
const ROWS_CACHE_MS = 10 * 60 * 1000;

async function cachedRows(): Promise<PowerBiRow[]> {
  if (rowsCache && Date.now() - rowsCache.at < ROWS_CACHE_MS) return rowsCache.rows;
  const rows = await fetchPowerBiRows();
  rowsCache = { rows, at: Date.now() };
  return rows;
}

/**
 * Called whenever a meeting is recorded: if the meeting's client isn't linked
 * to Power BI yet, try to match it to a row by name and pull its value in —
 * so the schedule that develops for the client is value-aware from the first
 * visit. Quietly does nothing when Power BI isn't configured or nothing
 * matches confidently; a failed attempt never blocks saving the meeting.
 */
export async function autoLinkClientToPowerBi(clientId: string): Promise<void> {
  if (!config.powerbiEnabled) return;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, clientName: true, businessName: true, powerBiName: true },
  });
  if (!client || client.powerBiName) return; // already linked

  const rows = await cachedRows();
  const byClient = rankMatches(client.clientName, rows, (r) => r.name, SUGGEST_MIN);
  const byBusiness = client.businessName
    ? rankMatches(client.businessName, rows, (r) => r.name, SUGGEST_MIN)
    : [];
  const best = [...byClient, ...byBusiness].sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < AUTO_MATCH) return;

  await prisma.client.update({
    where: { id: client.id },
    data: {
      annualValue: best.candidate.value,
      valueSource: best.candidate.value != null ? "powerbi" : undefined,
      powerBiName: best.candidate.name,
      powerBiSyncedAt: new Date(),
      salesRep: best.candidate.rep,
    },
  });
}

/** Manually link one client to a Power BI row (from the review UI). */
export async function linkClientToPowerBi(
  clientId: string,
  powerBiName: string,
  value: number | null,
): Promise<void> {
  let rep: string | null = null;
  try {
    rep = (await cachedRows()).find((r) => r.name === powerBiName)?.rep ?? null;
  } catch {
    /* rep lookup is best-effort */
  }
  await prisma.client.update({
    where: { id: clientId },
    data: {
      powerBiName,
      annualValue: value,
      valueSource: value != null ? "powerbi" : undefined,
      powerBiSyncedAt: new Date(),
      salesRep: rep,
    },
  });
}

/**
 * The full Power BI customer directory (cached) — the source of truth the
 * record-a-meeting flow matches spoken client names against.
 */
export async function getPowerBiDirectory(): Promise<PowerBiRow[]> {
  if (!config.powerbiEnabled) return [];
  try {
    return await cachedRows();
  } catch (e) {
    console.warn("Power BI directory unavailable:", e instanceof Error ? e.message : e);
    return [];
  }
}

export function isPowerBiError(e: unknown): e is PowerBiError {
  return e instanceof PowerBiError;
}
