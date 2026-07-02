import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleError, json } from "@/lib/api";
import { linkClientToPowerBi } from "@/lib/powerbi";

const linkSchema = z.object({
  clientId: z.string().min(1),
  powerBiName: z.string().trim().min(1).max(300),
  value: z.number().min(0).max(1_000_000_000).nullable().optional(),
});

// Manually link a client to a Power BI row (from the sync review UI).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = linkSchema.parse(body);
    await linkClientToPowerBi(input.clientId, input.powerBiName, input.value ?? null);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
