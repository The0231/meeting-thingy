import type { NextRequest } from "next/server";
import { handleError, json } from "@/lib/api";
import { createClient, getClients, type ClientFilter } from "@/lib/clients";
import { clientCreateSchema } from "@/lib/validation";
import type { IntervalMode, ReminderState } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filter: ClientFilter = {
      search: sp.get("search") || undefined,
      state: (sp.get("state") as ReminderState) || undefined,
      tag: sp.get("tag") || undefined,
      intervalMode: (sp.get("intervalMode") as IntervalMode) || undefined,
    };
    const clients = await getClients(filter);
    return json({ clients });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = clientCreateSchema.parse(body);
    const client = await createClient(input);
    return json({ client }, 201);
  } catch (e) {
    return handleError(e);
  }
}
