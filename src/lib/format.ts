// Display formatting helpers — safe to use in both server & client components.

import { format, parseISO } from "date-fns";
import type { ReminderState } from "./types";

export function fmtDate(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return fallback;
  }
}

export function fmtDay(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  try {
    return format(parseISO(iso), "EEE d MMM");
  } catch {
    return fallback;
  }
}

export function fmtMonthDay(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  try {
    return format(parseISO(iso), "d MMM");
  } catch {
    return fallback;
  }
}

/** A short human phrase describing where a client sits in its cycle. */
export function dueDescription(
  state: ReminderState,
  daysUntilDue: number | null,
  daysOverdue: number | null,
): string {
  switch (state) {
    case "overdue":
      return daysOverdue === 1 ? "1 day overdue" : `${daysOverdue} days overdue`;
    case "due_today":
      return "Due today";
    case "upcoming":
      return daysUntilDue === 1 ? "Due tomorrow" : `Due in ${daysUntilDue} days`;
    case "recent":
      return daysUntilDue != null ? `Next in ${daysUntilDue} days` : "On track";
    case "no_history":
      return "No meetings yet";
    case "paused":
      return "Reminders paused";
    default:
      return "";
  }
}

export function fmtMoney(value?: number | null, fallback = "—"): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}

export function confidenceLabel(c: "low" | "medium" | "high"): string {
  return c === "high" ? "High confidence" : c === "medium" ? "Building confidence" : "Low confidence";
}
