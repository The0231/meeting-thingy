import type { NextRequest } from "next/server";
import { handleError, json } from "@/lib/api";
import { updateClient } from "@/lib/clients";
import { intervalOverrideSchema } from "@/lib/validation";

// Update just a client's interval handling (PRD §6.9 manual overrides).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const input = intervalOverrideSchema.parse(body);
    const client = await updateClient(id, {
      intervalMode: input.intervalMode,
      manualIntervalDays: input.manualIntervalDays ?? null,
      customNextDate: input.customNextDate ?? null,
    });
    return json({ client });
  } catch (e) {
    return handleError(e);
  }
}
