"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function chipClasses(ev: CalendarEvent): string {
  if (ev.kind === "completed") return "bg-green-100 text-green-800";
  if (ev.kind === "scheduled") return "bg-blue-100 text-blue-800";
  // suggested follow-up — colour by urgency
  if (ev.reminderState === "overdue") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

export function Calendar() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
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
    } catch {
      setEvents([]);
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

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {format(cursor, "MMMM yyyy")}
          </h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost px-2 py-1"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="btn-secondary px-3 py-1 text-xs"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Today
          </button>
          <button
            className="btn-ghost px-2 py-1"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-medium text-gray-500">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          return (
            <div
              key={key}
              className={`min-h-[96px] border-b border-r border-gray-100 p-1.5 ${
                inMonth ? "bg-white" : "bg-gray-50/50"
              }`}
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
                    className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${chipClasses(ev)}`}
                    title={`${ev.clientName} — ${ev.kind}`}
                  >
                    {ev.kind === "suggested" ? "↻ " : ""}
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-xs text-gray-500">
        <Legend className="bg-green-400" label="Past meeting" />
        <Legend className="bg-blue-400" label="Scheduled" />
        <Legend className="bg-amber-400" label="Suggested follow-up" />
        <Legend className="bg-red-400" label="Overdue" />
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
