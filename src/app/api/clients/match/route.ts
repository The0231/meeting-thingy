import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleError, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { findNameInText, rankMatches } from "@/lib/match";

const matchSchema = z.object({
  // A transcript (or any spoken/typed text) to find a client mention in…
  text: z.string().trim().max(100000).optional(),
  // …or a plain name to match directly.
  name: z.string().trim().max(300).optional(),
});

/**
 * Match a spoken client name — either free text (a transcript) or a direct
 * name — against the client database. Returns the best candidates with
 * 0–1 confidence scores, best first.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, name } = matchSchema.parse(body);
    if (!text && !name) return json({ matches: [] });

    const clients = await prisma.client.findMany({
      select: { id: true, clientName: true, businessName: true },
    });

    // Match against both the client name and the business name; keep the
    // best score per client.
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
    return json({ matches });
  } catch (e) {
    return handleError(e);
  }
}
