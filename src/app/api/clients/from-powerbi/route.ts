import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, handleError, json } from "@/lib/api";
import { buildClientDTO } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { getPowerBiDirectory } from "@/lib/powerbi";

const schema = z.object({
  powerBiName: z.string().trim().min(1).max(300),
});

/**
 * Create a calendar client FROM a Power BI customer row — the only way the
 * record-a-meeting flow adds clients, so every meeting is tied to a real
 * customer. Idempotent: returns the existing client if the row is already
 * linked.
 */
export async function POST(req: NextRequest) {
  try {
    const { powerBiName } = schema.parse(await req.json());

    const existing = await prisma.client.findFirst({
      where: { powerBiName },
      include: { meetings: true },
    });
    if (existing) return json({ client: buildClientDTO(existing, existing.meetings), existed: true });

    const row = (await getPowerBiDirectory()).find((r) => r.name === powerBiName);
    if (!row) {
      return apiError(
        "That name isn't in the Power BI customer list. Search again — clients must match a real customer.",
        404,
      );
    }

    const client = await prisma.client.create({
      data: {
        clientName: row.name,
        annualValue: row.value,
        valueSource: row.value != null ? "powerbi" : null,
        powerBiName: row.name,
        powerBiSyncedAt: new Date(),
        salesRep: row.rep,
        // setupCompleted stays false → the record form asks the setup
        // questions (visit rhythm etc.) on the first meeting.
      },
      include: { meetings: true },
    });
    return json({ client: buildClientDTO(client, client.meetings), existed: false });
  } catch (e) {
    return handleError(e);
  }
}
