import { handleError, json } from "@/lib/api";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

// Connection + sync status for the Power BI page. Never exposes secrets —
// only which settings are present.
export async function GET() {
  try {
    const p = config.powerbi;
    const missing = [
      !p.tenantId && "POWERBI_TENANT_ID",
      !p.clientId && "POWERBI_CLIENT_ID",
      !p.clientSecret && "POWERBI_CLIENT_SECRET",
      !p.datasetId && "POWERBI_DATASET_ID",
      !p.daxQuery && !p.table && "POWERBI_CLIENT_TABLE",
      !p.daxQuery && !p.nameColumn && "POWERBI_CLIENT_NAME_COLUMN",
      !p.daxQuery && !p.valueColumn && "POWERBI_VALUE_COLUMN",
    ].filter(Boolean) as string[];

    const [linked, withValue, total, lastSynced] = await Promise.all([
      prisma.client.count({ where: { powerBiName: { not: null } } }),
      prisma.client.count({ where: { annualValue: { not: null } } }),
      prisma.client.count(),
      prisma.client.aggregate({ _max: { powerBiSyncedAt: true } }),
    ]);

    return json({
      configured: config.powerbiEnabled,
      missing,
      linked,
      withValue,
      total,
      lastSyncedAt: lastSynced._max.powerBiSyncedAt?.toISOString() ?? null,
    });
  } catch (e) {
    return handleError(e);
  }
}
