import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { PowerBiPanel } from "@/components/PowerBiPanel";

export const dynamic = "force-dynamic";

export default async function PowerBiPage() {
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Power BI"
        subtitle="Pull each client's sales value from your Power BI report and match it to the clients here — it feeds the visit priority."
      />
      <PowerBiPanel
        status={{
          configured: config.powerbiEnabled,
          missing,
          linked,
          withValue,
          total,
          lastSyncedAt: lastSynced._max.powerBiSyncedAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
