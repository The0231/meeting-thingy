import type { NextRequest } from "next/server";
import { handleError, json } from "@/lib/api";
import { getClients } from "@/lib/clients";

// Lightweight global search over clients (used for quick lookups).
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() || "";
    if (!q) return json({ clients: [] });
    const clients = await getClients({ search: q });
    return json({ clients: clients.slice(0, 20) });
  } catch (e) {
    return handleError(e);
  }
}
