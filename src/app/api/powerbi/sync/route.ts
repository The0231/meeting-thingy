import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, handleError, json } from "@/lib/api";
import { config } from "@/lib/config";
import {
  isPowerBiError,
  syncPowerBi,
  syncSalesSnapshots,
  type SalesHistorySyncResult,
} from "@/lib/powerbi";

const syncSchema = z.object({
  // Also create clients for Power BI rows that match nobody.
  createMissing: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { createMissing } = syncSchema.parse(body);
    const result = await syncPowerBi({ createMissing });

    // If the dataset can also supply month-by-month history, refresh the
    // sales-health snapshots too. A failure here shouldn't fail the value sync.
    let salesHistory: SalesHistorySyncResult | null = null;
    if (config.salesHistoryEnabled) {
      try {
        salesHistory = await syncSalesSnapshots();
      } catch (e) {
        console.warn("Sales-history sync failed:", e instanceof Error ? e.message : e);
      }
    }

    return json({ result, salesHistory });
  } catch (e) {
    if (isPowerBiError(e)) return apiError(e.message, 502);
    return handleError(e);
  }
}
