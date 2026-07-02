import type { NextRequest } from "next/server";
import { handleError, json } from "@/lib/api";
import { getClients } from "@/lib/clients";
import { prisma } from "@/lib/db";
import type { MeetingType, ReminderState } from "@/lib/types";

interface CalendarEvent {
  id: string;
  date: string;
  kind: "completed" | "scheduled" | "suggested";
  clientId: string;
  clientName: string;
  meetingType?: MeetingType;
  reminderState?: ReminderState;
}

/** Parse a date query param; ignore it (undefined) if malformed. */
function parseDateParam(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const from = parseDateParam(sp.get("from"));
    const to = parseDateParam(sp.get("to"));

    const meetings = await prisma.meeting.findMany({
      where: {
        status: { in: ["completed", "scheduled"] },
        meetingDate: from || to ? { gte: from, lte: to } : undefined,
      },
      include: { client: { select: { clientName: true } } },
    });

    const events: CalendarEvent[] = meetings.map((m) => ({
      id: m.id,
      date: m.meetingDate.toISOString(),
      kind: m.status === "scheduled" ? "scheduled" : "completed",
      clientId: m.clientId,
      clientName: m.client.clientName,
      meetingType: m.meetingType as MeetingType,
    }));

    // Suggested follow-ups (computed, not stored): each client's next due date.
    const clients = await getClients();
    for (const c of clients) {
      if (!c.nextSuggestedDate) continue;
      if (c.reminderState === "paused" || c.reminderState === "no_history") continue;
      const d = new Date(c.nextSuggestedDate);
      if (from && d < from) continue;
      if (to && d > to) continue;
      events.push({
        id: `suggest-${c.id}`,
        date: c.nextSuggestedDate,
        kind: "suggested",
        clientId: c.id,
        clientName: c.clientName,
        reminderState: c.reminderState,
      });
    }

    return json({ events });
  } catch (e) {
    return handleError(e);
  }
}
