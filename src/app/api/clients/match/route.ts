import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleError, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { findNameInText, rankMatches } from "@/lib/match";
import { getPowerBiDirectory } from "@/lib/powerbi";

const matchSchema = z.object({
  // A transcript (or any spoken/typed text) to find a client mention in…
  text: z.string().trim().max(100000).optional(),
  // …or a plain name to match directly.
  name: z.string().trim().max(300).optional(),
});

/**
 * Match a spoken/typed client name against BOTH:
 *   1. existing calendar clients, and
 *   2. the live Power BI customer directory (the source of truth — reps must
 *      link meetings to real customers, not made-up names).
 * Returns each list separately so the UI can offer "create from Power BI".
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, name } = matchSchema.parse(body);
    if (!text && !name) return json({ matches: [], powerbi: [] });

    const [clients, directory] = await Promise.all([
      prisma.client.findMany({
        select: { id: true, clientName: true, businessName: true, powerBiName: true },
      }),
      getPowerBiDirectory(),
    ]);

    // ---- existing calendar clients ----
    const byId = new Map<string, { clientId: string; clientName: string; score: number }>();
    const consider = (id: string, clientName: string, score: number) => {
      const existing = byId.get(id);
      if (!existing || score > existing.score)
        byId.set(id, { clientId: id, clientName, score: Math.round(score * 100) / 100 });
    };
    if (name) {
      for (const m of rankMatches(name, clients, (c) => c.clientName))
        consider(m.candidate.id, m.candidate.clientName, m.score);
      for (const m of rankMatches(
        name,
        clients.filter((c) => c.businessName),
        (c) => c.businessName!,
      ))
        consider(m.candidate.id, m.candidate.clientName, m.score);
    }
    if (text) {
      for (const m of findNameInText(text, clients, (c) => c.clientName))
        consider(m.candidate.id, m.candidate.clientName, m.score);
      for (const m of findNameInText(
        text,
        clients.filter((c) => c.businessName),
        (c) => c.businessName!,
      ))
        consider(m.candidate.id, m.candidate.clientName, m.score);
    }
    const matches = [...byId.values()].sort((a, b) => b.score - a.score).slice(0, 5);

    // ---- Power BI directory (skip rows already linked to a client) ----
    const linked = new Set(clients.map((c) => c.powerBiName).filter(Boolean));
    const candidates = directory.filter((r) => !linked.has(r.name));
    const pbiBest = new Map<string, { name: string; value: number | null; rep: string | null; score: number }>();
    const considerPbi = (row: (typeof candidates)[number], score: number) => {
      const existing = pbiBest.get(row.name);
      if (!existing || score > existing.score)
        pbiBest.set(row.name, { name: row.name, value: row.value, rep: row.rep, score: Math.round(score * 100) / 100 });
    };
    if (name) for (const m of rankMatches(name, candidates, (r) => r.name)) considerPbi(m.candidate, m.score);
    if (text) for (const m of findNameInText(text, candidates, (r) => r.name)) considerPbi(m.candidate, m.score);
    const powerbi = [...pbiBest.values()].sort((a, b) => b.score - a.score).slice(0, 5);

    return json({ matches, powerbi, directoryAvailable: directory.length > 0 });
  } catch (e) {
    return handleError(e);
  }
}
