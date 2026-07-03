import type { NextRequest } from "next/server";
import { handleError, json } from "@/lib/api";
import { getClients } from "@/lib/clients";
import { config } from "@/lib/config";
import { startOfDay, toDateKey } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getSalesAlertsByClient } from "@/lib/sales";
import type { SalesAlert } from "@/lib/sales-health";
import { chooseVisitDate } from "@/lib/suggest";
import type { MeetingType } from "@/lib/types";

// The calendar GRID shows ONLY real visits: past meetings and scheduled visits.
// Suggested visits are never painted on the grid — they live in a side panel.
interface CalendarEvent {
  id: string;
  date: string;
  kind: "completed" | "scheduled";
  clientId: string;
  clientName: string;
  meetingType?: MeetingType;
}

// A suggestion's urgency, by where "today" sits relative to the ±25% window
// around the due date. Ordered most-urgent first.
type SuggestionPriority = "missed" | "late" | "due" | "soon";

interface Suggestion {
  clientId: string;
  clientName: string;
  dueDate: string | null;
  /** Concrete recommended date (yyyy-MM-dd) — due-aware and batched. */
  suggestedDate: string;
  /** How many visits are already booked on the suggested date (0 = fresh). */
  suggestedBatchCount: number;
  lastMeetingDate: string | null;
  intervalLabel: string;
  daysUntilDue: number | null; // negative = past due, null = no rhythm yet
  daysOverdue: number | null;
  windowRadius: number; // ±25% of the interval, in days (min 1)
  priority: SuggestionPriority;
  /** Power BI sales-health flags (down / stopped / switched), if any. */
  salesAlerts: SalesAlert[];
}

// A booked visit whose date has passed but that still hasn't been logged.
interface NeedsLogging {
  meetingId: string;
  clientId: string;
  clientName: string;
  scheduledDate: string;
  daysSince: number;
}

function parseDateParam(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

// Most-urgent first. A high-severity sales alert is treated as urgent as a
// fully-missed visit, so a client whose orders have collapsed surfaces at the
// top even if their visit rhythm says they're not due yet.
function urgencyRank(s: Suggestion): number {
  const hasHigh = s.salesAlerts.some((a) => a.severity === "high");
  const hasAlert = s.salesAlerts.length > 0;
  const bySales = hasHigh ? 0 : hasAlert ? 1 : 3;
  const byTiming =
    s.priority === "missed" ? 0 : s.priority === "late" ? 1 : s.priority === "due" ? 2 : 3;
  return Math.min(bySales, byTiming);
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const from = parseDateParam(sp.get("from"));
    const to = parseDateParam(sp.get("to"));

    // ---- Grid: real visits only (past + scheduled) within the view window ----
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

    const today = startOfDay(new Date());

    // Any pending scheduled visit means the client is already booked — don't
    // also suggest one. Past scheduled visits (unlogged) go to needsLogging.
    const allScheduled = await prisma.meeting.findMany({
      where: { status: "scheduled" },
      include: { client: { select: { clientName: true } } },
      orderBy: { meetingDate: "asc" },
    });
    const bookedClientIds = new Set(allScheduled.map((m) => m.clientId));
    const needsLogging: NeedsLogging[] = allScheduled
      .filter((m) => startOfDay(m.meetingDate) < today)
      .map((m) => ({
        meetingId: m.id,
        clientId: m.clientId,
        clientName: m.client.clientName,
        scheduledDate: m.meetingDate.toISOString(),
        daysSince: Math.round(
          (today.getTime() - startOfDay(m.meetingDate).getTime()) / 86400000,
        ),
      }));

    // Days the rep is already out visiting — future scheduled visits, counted
    // per day so a new suggestion can be nudged onto an existing busy day.
    const scheduledCountByDay = new Map<string, number>();
    for (const m of allScheduled) {
      const d = startOfDay(m.meetingDate);
      if (d < today) continue;
      const key = toDateKey(d);
      scheduledCountByDay.set(key, (scheduledCountByDay.get(key) ?? 0) + 1);
    }

    // ---- Suggestions: due within the horizon, or sales-flagged --------------
    const clients = await getClients();
    const salesAlertsByClient = await getSalesAlertsByClient();
    const horizon = config.suggestionHorizonDays;
    const flexDays = config.suggestionBatchFlexDays;

    const suggestions: Suggestion[] = [];
    for (const c of clients) {
      if (c.reminderState === "paused") continue;
      if (bookedClientIds.has(c.id)) continue;
      // Respect an active push-back / skip for both rhythm and sales prompts.
      if (c.snoozedUntil) {
        const su = startOfDay(new Date(c.snoozedUntil));
        if (su > today) continue;
      }

      const salesAlerts = salesAlertsByClient.get(c.id) ?? [];
      const hasSalesAlert = salesAlerts.length > 0;

      const interval = c.effectiveIntervalDays ?? config.defaultIntervalDays;
      const windowRadius = Math.max(1, Math.round(interval * 0.25));
      const inclusionLimit = Math.max(windowRadius, horizon);

      // Rhythm-eligible: has a due date and it's within the look-ahead horizon.
      const timingEligible =
        c.nextSuggestedDate != null &&
        c.daysUntilDue != null &&
        c.reminderState !== "no_history" &&
        c.daysUntilDue <= inclusionLimit;

      // Show a client if their rhythm is due OR their sales have been flagged.
      if (!timingEligible && !hasSalesAlert) continue;

      // Timing bucket (used for the badge + colour when there's no sales flag).
      let priority: SuggestionPriority;
      if (c.daysUntilDue == null) priority = "soon";
      else if (c.daysUntilDue < -windowRadius) priority = "missed";
      else if (c.daysUntilDue < 0) priority = "late";
      else if (c.daysUntilDue <= windowRadius) priority = "due";
      else priority = "soon";

      // Concrete date: aim for the due date when they're genuinely due; for a
      // sales-only flag, aim for "soon" (today) rather than a far-off rhythm
      // date. Then batch onto a nearby day the rep is already out.
      const dueForPicker =
        timingEligible && c.nextSuggestedDate
          ? new Date(c.nextSuggestedDate)
          : today;
      const chosen = chooseVisitDate({
        dueDate: dueForPicker,
        today,
        flexDays,
        scheduledCountByDay,
      });

      suggestions.push({
        clientId: c.id,
        clientName: c.clientName,
        dueDate: c.nextSuggestedDate,
        suggestedDate: toDateKey(chosen.date),
        suggestedBatchCount: chosen.batchedWith,
        lastMeetingDate: c.lastMeetingDate,
        intervalLabel: c.intervalLabel,
        daysUntilDue: timingEligible ? c.daysUntilDue : null,
        daysOverdue: timingEligible ? c.daysOverdue : null,
        windowRadius,
        priority,
        salesAlerts,
      });
    }

    // Rank: urgency group first (sales/overdue), then soonest due, then name.
    suggestions.sort((a, b) => {
      const r = urgencyRank(a) - urgencyRank(b);
      if (r !== 0) return r;
      const ad = a.daysUntilDue ?? horizon;
      const bd = b.daysUntilDue ?? horizon;
      if (ad !== bd) return ad - bd;
      return a.clientName.localeCompare(b.clientName);
    });

    // Lightweight client list for the manual "Schedule meeting" picker.
    const clientOptions = clients
      .map((c) => ({ id: c.id, clientName: c.clientName }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName));

    return json({ events, suggestions, needsLogging, clients: clientOptions });
  } catch (e) {
    return handleError(e);
  }
}
