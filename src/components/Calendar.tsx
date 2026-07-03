"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PackageX,
  Sparkles,
  TrendingDown,
  Users,
  X,
} from "lucide-react";
import type { SalesAlert, SalesAlertType } from "@/lib/sales-health";
import { LABELS, MEETING_TYPES, type MeetingType } from "@/lib/types";

interface CalendarEvent {
  id: string;
  date: string;
  kind: "completed" | "scheduled";
  clientId: string;
  clientName: string;
  meetingType?: MeetingType;
}

type SuggestionPriority = "missed" | "late" | "due" | "soon";

interface Suggestion {
  clientId: string;
  clientName: string;
  dueDate: string | null;
  suggestedDate: string; // yyyy-MM-dd
  suggestedBatchCount: number;
  lastMeetingDate: string | null;
  intervalLabel: string;
  daysUntilDue: number | null;
  daysOverdue: number | null;
  windowRadius: number;
  priority: SuggestionPriority;
  salesAlerts: SalesAlert[];
}

interface NeedsLogging {
  meetingId: string;
  clientId: string;
  clientName: string;
  scheduledDate: string;
  daysSince: number;
}

interface ClientOption {
  id: string;
  clientName: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Real visits only on the grid: past meetings (green), scheduled visits (blue).
function chipClasses(kind: CalendarEvent["kind"]): string {
  return kind === "completed"
    ? "bg-green-100 text-green-800"
    : "bg-blue-100 text-blue-800";
}

type CalendarView = "month" | "day";

export function Calendar() {
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  // Null in month view (nothing highlighted); the zoomed-in day in day view.
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [needsLogging, setNeedsLogging] = useState<NeedsLogging[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const gridStart = useMemo(
    () => startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    [cursor],
  );
  const gridEnd = useMemo(
    () => endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
    [cursor],
  );
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: gridStart.toISOString(),
        to: gridEnd.toISOString(),
      });
      const res = await fetch(`/api/calendar?${params}`);
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setNeedsLogging(Array.isArray(data.needsLogging) ? data.needsLogging : []);
      setClients(Array.isArray(data.clients) ? data.clients : []);
    } catch {
      setEvents([]);
      setSuggestions([]);
      setNeedsLogging([]);
    } finally {
      setLoading(false);
    }
  }, [gridStart, gridEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = format(parseISO(ev.date), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  // Click a day → zoom into that single day.
  function zoomToDay(day: Date) {
    setSelectedDay(day);
    setCursor(startOfMonth(day));
    setView("day");
  }
  // Step the header arrows: whole months in month view, single days in day view.
  function step(dir: 1 | -1) {
    if (view === "day" && selectedDay) {
      const nd = addDays(selectedDay, dir);
      setSelectedDay(nd);
      setCursor(startOfMonth(nd));
    } else {
      setCursor((c) => addMonths(c, dir));
    }
  }
  function goToday() {
    const now = new Date();
    if (view === "day") zoomToDay(now);
    else setCursor(startOfMonth(now));
  }
  function showMonth() {
    setView("month");
    setSelectedDay(null); // clear the highlight — month view shows everything
  }
  function showDay() {
    zoomToDay(selectedDay ?? new Date());
  }

  const dayKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : "";
  const dayMeetings = selectedDay ? (eventsByDay.get(dayKey) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Missed / overdue booked visits still to be logged */}
      <NeedsLoggingPanel items={needsLogging} onChanged={load} />

      {/* Calendar — real visits only (never suggestions) */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {view === "day" && selectedDay
                ? format(selectedDay, "EEEE d MMMM")
                : format(cursor, "MMMM yyyy")}
            </h2>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="btn-ghost px-2 py-1"
              onClick={() => step(-1)}
              aria-label={view === "day" ? "Previous day" : "Previous month"}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="btn-secondary px-3 py-1 text-xs" onClick={goToday}>
              Today
            </button>
            {/* Month / Day view toggle */}
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
              <button
                onClick={showMonth}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  view === "month"
                    ? "bg-brand-600 text-white"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Month
              </button>
              <button
                onClick={showDay}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  view === "day"
                    ? "bg-brand-600 text-white"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Day
              </button>
            </div>
            <button
              className="btn-ghost px-2 py-1"
              onClick={() => step(1)}
              aria-label={view === "day" ? "Next day" : "Next month"}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {view === "month" ? (
          <>
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-medium text-gray-500">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = eventsByDay.get(key) ?? [];
                const inMonth = isSameMonth(day, cursor);
                return (
                  <div
                    key={key}
                    onClick={() => zoomToDay(day)}
                    className={`min-h-[96px] cursor-pointer border-b border-r border-gray-100 p-1.5 transition-colors ${
                      inMonth
                        ? "bg-white hover:bg-brand-50/40"
                        : "bg-gray-50/50 hover:bg-gray-100/60"
                    }`}
                    title="Click to zoom into this day"
                  >
                    <div
                      className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        isToday(day)
                          ? "bg-brand-600 font-semibold text-white"
                          : inMonth
                            ? "text-gray-700"
                            : "text-gray-400"
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <Link
                          key={ev.id}
                          href={`/clients/${ev.clientId}`}
                          onClick={(e) => e.stopPropagation()}
                          className={`block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${chipClasses(ev.kind)}`}
                          title={`${ev.clientName} — ${ev.kind === "completed" ? "met" : "scheduled"}`}
                        >
                          {ev.kind === "scheduled" ? "📅 " : ""}
                          {ev.clientName}
                        </Link>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="px-1 text-[10px] text-gray-400">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-xs text-gray-500">
              <Legend className="bg-green-400" label="Past meeting" />
              <Legend className="bg-blue-400" label="Scheduled visit" />
            </div>
          </>
        ) : (
          selectedDay && <DayFocus day={selectedDay} meetings={dayMeetings} />
        )}
      </div>

      {/* Suggested visits — everything upcoming in month view; just this day's
          when zoomed in. */}
      {view === "month" || !selectedDay ? (
        <SuggestionsPanel suggestions={suggestions} loading={loading} onChanged={load} />
      ) : (
        <DaySuggestions day={selectedDay} suggestions={suggestions} onChanged={load} />
      )}

      {/* Manual scheduling — the single primary action */}
      <ScheduleMeetingBar clients={clients} onChanged={load} />
    </div>
  );
}

// The zoomed-in single day: its real booked/completed visits.
function DayFocus({ day, meetings }: { day: Date; meetings: CalendarEvent[] }) {
  return (
    <div className="card-pad space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold ${
            isToday(day) ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
          }`}
        >
          {format(day, "d")}
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {isToday(day) ? "Today" : format(day, "EEEE")}
          </p>
          <p className="text-xs text-gray-500">{format(day, "MMMM yyyy")}</p>
        </div>
      </div>

      {meetings.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Booked this day</p>
          {meetings.map((ev) => (
            <Link
              key={ev.id}
              href={`/clients/${ev.clientId}`}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm ${
                ev.kind === "completed" ? "bg-green-50/70" : "bg-blue-50/70"
              }`}
            >
              <span className="font-medium text-gray-900">{ev.clientName}</span>
              <span className="text-xs text-gray-500">
                {ev.kind === "completed" ? "met" : "scheduled visit"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No visits booked on this day yet.</p>
      )}
    </div>
  );
}

// ---- Suggested visits -------------------------------------------------------

const PRIORITY_STYLE: Record<
  SuggestionPriority,
  { row: string; badge: string; label: string }
> = {
  missed: {
    row: "border border-red-200 bg-red-50",
    badge: "bg-red-100 text-red-700",
    label: "Missed",
  },
  late: {
    row: "bg-orange-50",
    badge: "bg-orange-100 text-orange-700",
    label: "Overdue",
  },
  due: {
    row: "bg-amber-50/80",
    badge: "bg-amber-100 text-amber-800",
    label: "Due",
  },
  soon: {
    row: "bg-gray-50",
    badge: "bg-gray-100 text-gray-600",
    label: "Coming up",
  },
};

// When Power BI flags a sales problem, that takes over the row's look — it's a
// stronger reason to visit than the calendar rhythm alone.
const SALES_STYLE = {
  high: { row: "border border-rose-200 bg-rose-50", badge: "bg-rose-100 text-rose-700" },
  medium: { row: "border border-rose-100 bg-rose-50/60", badge: "bg-rose-100 text-rose-700" },
} as const;

function timingText(s: Suggestion): string {
  const d = s.daysUntilDue;
  if (d == null) return "";
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`;
  if (d === 0) return "due today";
  return `due in ${d} day${d === 1 ? "" : "s"}`;
}

// Icon per sales-health flag, shown on the suggestion row.
const SALES_ALERT_ICON: Record<SalesAlertType, typeof TrendingDown> = {
  volume_drop: TrendingDown,
  stopped_ordering: PackageX,
  product_shift: PackageX,
};

const LATER_PRESETS = [
  { days: 1, label: "Tomorrow" },
  { days: 3, label: "In 3 days" },
  { days: 7, label: "In a week" },
];

// Does a suggestion belong to a specific day? Governed by the ±25% window
// around the client's due date; sales-only flags (no due date) show on the
// concrete date the tool recommends.
function dueOnDay(s: Suggestion, day: Date): boolean {
  if (s.dueDate) {
    return Math.abs(differenceInCalendarDays(day, parseISO(s.dueDate))) <= s.windowRadius;
  }
  return s.suggestedDate === format(day, "yyyy-MM-dd");
}

// One suggestion — the row plus its inline "schedule" / "not now" editors.
// Self-contained so it can appear in both the month list and a single day.
function SuggestionRow({
  s,
  defaultDate,
  onChanged,
}: {
  s: Suggestion;
  /** Pre-fill the date box with this day (yyyy-MM-dd) instead of the smart date. */
  defaultDate?: string;
  onChanged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<"none" | "schedule" | "later">("none");
  const [scheduleDate, setScheduleDate] = useState("");
  const [laterDays, setLaterDays] = useState("");
  const [busy, setBusy] = useState(false);

  function openSchedule() {
    const base = defaultDate ?? s.suggestedDate;
    setScheduleDate(base >= today ? base : today);
    setMode((m) => (m === "schedule" ? "none" : "schedule"));
  }

  async function schedule() {
    if (!scheduleDate) return;
    setBusy(true);
    try {
      await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: s.clientId,
          meetingDate: new Date(`${scheduleDate}T12:00:00`).toISOString(),
          meetingType: "in_person",
          status: "scheduled",
        }),
      });
      setMode("none");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function snooze(action: "push" | "skip", days?: number) {
    setBusy(true);
    try {
      await fetch(`/api/clients/${s.clientId}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, days }),
      });
      setMode("none");
      setLaterDays("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const topAlert = s.salesAlerts[0] ?? null;
  const highAlert = s.salesAlerts.some((a) => a.severity === "high");
  const st = PRIORITY_STYLE[s.priority];
  const rowClass = highAlert
    ? SALES_STYLE.high.row
    : topAlert
      ? SALES_STYLE.medium.row
      : st.row;
  const flagged = s.priority === "missed" || highAlert;
  const metaLine = [
    timingText(s),
    s.lastMeetingDate ? `last seen ${format(parseISO(s.lastMeetingDate), "d MMM")}` : "",
    s.intervalLabel ? `usually ${s.intervalLabel.toLowerCase()}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`rounded-xl px-4 py-2.5 ${rowClass}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
            {flagged && <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />}
            <span className="truncate">{s.clientName}</span>
            {topAlert ? (
              <span className={`badge ${SALES_STYLE[topAlert.severity].badge}`}>
                Needs a visit
              </span>
            ) : (
              <span className={`badge ${st.badge}`}>{st.label}</span>
            )}
          </p>

          {/* Why Power BI flagged them */}
          {s.salesAlerts.map((a, i) => {
            const Icon = SALES_ALERT_ICON[a.type];
            return (
              <p key={i} className="mt-0.5 flex items-start gap-1.5 text-xs text-rose-700">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium">{a.title}.</span> {a.detail}
                </span>
              </p>
            );
          })}

          {/* Visit rhythm context */}
          {metaLine && <p className="mt-0.5 text-xs text-gray-500">{metaLine}</p>}

          {/* The concrete date we recommend, with a batching hint */}
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
            <CalendarPlus className="h-3.5 w-3.5 text-brand-500" />
            <span className="font-medium text-gray-800">
              Suggested: {format(parseISO(s.suggestedDate), "EEE d MMM")}
            </span>
            {s.suggestedBatchCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700">
                <Users className="h-3 w-3" />
                with {s.suggestedBatchCount} other visit
                {s.suggestedBatchCount === 1 ? "" : "s"} that day
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={openSchedule}
          className="btn-primary px-3 py-1.5 text-xs"
          title="Put this visit on the calendar"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Schedule
        </button>
        <button
          type="button"
          onClick={() => {
            setLaterDays("");
            setMode((m) => (m === "later" ? "none" : "later"));
          }}
          className="btn-ghost px-2.5 py-1.5 text-xs text-gray-500"
          title="Remind me later or skip this cycle"
        >
          Not now
        </button>
      </div>

      {/* Schedule → pick a date */}
      {mode === "schedule" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white/80 px-3 py-2">
          <span className="text-xs text-gray-500">Schedule for:</span>
          <input
            type="date"
            className="input w-44 py-1 text-xs"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !scheduleDate}
            onClick={schedule}
            className="btn-primary px-3 py-1 text-xs"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Add to calendar
          </button>
          <button
            type="button"
            onClick={() => setMode("none")}
            className="btn-ghost px-2 py-1 text-xs text-gray-400"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Not now → remind later / skip this cycle */}
      {mode === "later" && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-white/80 px-3 py-2">
          <span className="mr-1 text-xs text-gray-500">Remind me:</span>
          {LATER_PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => snooze("push", p.days)}
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {p.label}
            </button>
          ))}
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            in
            <input
              type="number"
              min={1}
              className="input w-14 py-1 text-xs"
              placeholder="N"
              value={laterDays}
              onChange={(e) => setLaterDays(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && parseInt(laterDays, 10) > 0)
                  snooze("push", parseInt(laterDays, 10));
              }}
            />
            days
          </span>
          <span className="mx-1 text-gray-300">|</span>
          <button
            type="button"
            onClick={() => snooze("skip")}
            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            title="Skip this cycle — don't suggest again until next time"
          >
            Skip this visit
          </button>
        </div>
      )}
    </div>
  );
}

// Month view: everything coming up in the next few weeks + sales flags.
function SuggestionsPanel({
  suggestions,
  loading,
  onChanged,
}: {
  suggestions: Suggestion[];
  loading: boolean;
  onChanged: () => void;
}) {
  const missedCount = suggestions.filter(
    (s) => s.priority === "missed" && s.salesAlerts.length === 0,
  ).length;
  const salesCount = suggestions.filter((s) => s.salesAlerts.length > 0).length;

  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-500" />
        <h3 className="text-sm font-semibold text-gray-900">Suggested visits</h3>
        <span className="text-xs text-gray-400">
          due over the next few weeks, plus anyone flagged by sales
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-300" />}
      </div>

      {salesCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">
          <TrendingDown className="h-4 w-4 shrink-0" />
          {salesCount} client{salesCount === 1 ? "" : "s"} flagged from sales —
          ordering has dropped, stopped, or changed. Worth a catch-up.
        </div>
      )}

      {missedCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {missedCount} visit{missedCount === 1 ? "" : "s"} fully missed — schedule
          or skip {missedCount === 1 ? "it" : "them"}.
        </div>
      )}

      {suggestions.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nothing due over the next few weeks. Clients appear here as they
          approach their usual visit interval, or if their sales drop off.
        </p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <SuggestionRow key={s.clientId} s={s} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

// Day view: only the visits that belong to the zoomed-in day (±25% window).
function DaySuggestions({
  day,
  suggestions,
  onChanged,
}: {
  day: Date;
  suggestions: Suggestion[];
  onChanged: () => void;
}) {
  const dayKey = format(day, "yyyy-MM-dd");
  const forDay = suggestions.filter((s) => dueOnDay(s, day));

  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-500" />
        <h3 className="text-sm font-semibold text-gray-900">
          Suggested for {format(day, "EEE d MMM")}
        </h3>
        <span className="text-xs text-gray-400">
          clients whose visit window lands on this day
        </span>
      </div>

      {forDay.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nothing is due around this day. Switch to <span className="font-medium">Month</span>{" "}
          view to see everything coming up.
        </p>
      ) : (
        <div className="space-y-2">
          {forDay.map((s) => (
            <SuggestionRow key={s.clientId} s={s} defaultDate={dayKey} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Manual schedule --------------------------------------------------------

function ScheduleMeetingBar({
  clients,
  onChanged,
}: {
  clients: ClientOption[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("in_person");
  const [busy, setBusy] = useState(false);

  async function schedule() {
    if (!clientId || !date) return;
    setBusy(true);
    try {
      await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          meetingDate: new Date(`${date}T12:00:00`).toISOString(),
          meetingType: type,
          status: "scheduled",
        }),
      });
      setOpen(false);
      setClientId("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      {!open ? (
        <button className="btn-primary px-8 py-3 text-base" onClick={() => setOpen(true)}>
          <CalendarPlus className="h-5 w-5" />
          Schedule meeting
        </button>
      ) : (
        <div className="card card-pad w-full max-w-lg space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Schedule a visit</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="label">Client</label>
              <select
                className="input"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Select…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.clientName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LABELS.meetingType[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="btn-ghost px-3 py-1.5 text-xs text-gray-400"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary px-4 py-1.5 text-xs"
              disabled={busy || !clientId}
              onClick={schedule}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Add to calendar
            </button>
          </div>
        </div>
      )}
      <Link
        href="/record"
        className="text-xs text-gray-400 underline decoration-dotted underline-offset-2 hover:text-gray-600"
      >
        or log a meeting that already happened
      </Link>
    </div>
  );
}

// ---- Needs logging ----------------------------------------------------------

function NeedsLoggingPanel({
  items,
  onChanged,
}: {
  items: NeedsLogging[];
  onChanged: () => void;
}) {
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function patch(meetingId: string, body: Record<string, unknown>) {
    setBusy(meetingId);
    try {
      await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setRescheduleFor(null);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card card-pad border-amber-200 bg-amber-50/60">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-gray-900">Did these visits happen?</h3>
        <span className="text-xs text-gray-500">booked, but not logged yet</span>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.meetingId} className="rounded-xl bg-white/80 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{it.clientName}</p>
                <p className="text-xs text-gray-500">
                  booked for {format(parseISO(it.scheduledDate), "EEE d MMM")}
                  {" · "}
                  {it.daysSince === 1 ? "yesterday" : `${it.daysSince} days ago`}
                </p>
              </div>
              <Link
                href={`/record?meetingId=${it.meetingId}`}
                className="btn-primary px-3 py-1.5 text-xs"
                title="Record what happened"
              >
                Log it
              </Link>
              <button
                type="button"
                onClick={() => {
                  setNewDate(new Date().toISOString().slice(0, 10));
                  setRescheduleFor(rescheduleFor === it.meetingId ? null : it.meetingId);
                }}
                className="btn-secondary px-3 py-1.5 text-xs"
                title="Move it to a new date"
              >
                Reschedule
              </button>
              <button
                type="button"
                disabled={busy === it.meetingId}
                onClick={() => patch(it.meetingId, { status: "cancelled" })}
                className="btn-ghost px-2.5 py-1.5 text-xs text-gray-500 hover:text-status-overdue"
                title="It didn't happen — mark it cancelled"
              >
                {busy === it.meetingId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                Cancelled
              </button>
            </div>

            {rescheduleFor === it.meetingId && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-xs text-gray-500">New date:</span>
                <input
                  type="date"
                  className="input w-44 py-1 text-xs"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy === it.meetingId || !newDate}
                  onClick={() =>
                    patch(it.meetingId, {
                      status: "scheduled",
                      meetingDate: new Date(`${newDate}T12:00:00`).toISOString(),
                    })
                  }
                  className="btn-primary px-3 py-1 text-xs"
                >
                  <Check className="h-3.5 w-3.5" /> Move
                </button>
                <button
                  type="button"
                  onClick={() => setRescheduleFor(null)}
                  className="btn-ghost px-2 py-1 text-xs text-gray-400"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
