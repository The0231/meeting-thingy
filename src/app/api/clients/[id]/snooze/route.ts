import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, handleError, json } from "@/lib/api";
import { getClient } from "@/lib/clients";
import { prisma } from "@/lib/db";

const snoozeSchema = z.object({
  // push   = move the suggestion back by `days`
  // skip   = skip this visit entirely (one full cycle)
  // clear  = undo, suggestion returns to its natural date
  // reason = attach/replace the optional "why" on an existing snooze
  action: z.enum(["push", "skip", "clear", "reason"]),
  days: z.number().int().positive().max(365).optional(),
  // The "why" — always optional, never demanded.
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { action, days, reason } = snoozeSchema.parse(await req.json());

    const dto = await getClient(id);
    if (!dto) return apiError("Client not found", 404);

    if (action === "reason") {
      await prisma.client.update({ where: { id }, data: { snoozeReason: reason || null } });
      return json({ client: await getClient(id) });
    }

    let snoozedUntil: Date | null = null;
    if (action === "push") {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + (days ?? 7));
      snoozedUntil = d;
    } else if (action === "skip") {
      // Skip this cycle: acknowledge and suggest again about one interval from
      // NOW (works even when the visit is already well overdue / missed).
      const cycle = dto.effectiveIntervalDays ?? 30;
      const base = new Date();
      base.setHours(12, 0, 0, 0);
      base.setDate(base.getDate() + cycle);
      snoozedUntil = base;
    }

    await prisma.client.update({
      where: { id },
      data: {
        snoozedUntil,
        snoozeReason: action === "clear" ? null : (reason || null),
      },
    });

    const client = await getClient(id);
    return json({ client });
  } catch (e) {
    return handleError(e);
  }
}
