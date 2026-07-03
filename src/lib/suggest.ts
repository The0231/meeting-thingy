// ============================================================================
// Picking a concrete date for a suggested visit.
//
// A suggestion isn't much use as "sometime around the 8th" — the rep wants a
// specific day they can accept or tweak. This turns a due date into a real
// calendar date that:
//   1. is never in the past (a visit can only be booked from today on),
//   2. lands on a weekday (reps are out on weekdays),
//   3. gravitates toward days the rep is ALREADY out visiting other clients,
//      within a sensible window around the due date — so visits batch into
//      efficient days instead of scattering one-per-trip.
//
// Pure + deterministic ("today" injectable) so it's easy to test.
// ============================================================================

import { addDays, startOfDay, toDateKey } from "./dates";

export interface ChooseVisitDateOptions {
  /** The rhythm/alert-driven target date (when they're "due"). */
  dueDate: Date;
  /** "Now". */
  today: Date;
  /**
   * How many days either side of the target we'll shift a visit to batch it
   * with an existing day. Kept modest so a visit never drifts far from due.
   */
  flexDays: number;
  /** yyyy-MM-dd -> number of visits already booked that day. */
  scheduledCountByDay: Map<string, number>;
  /** Skip Saturdays/Sundays (default true). */
  avoidWeekends?: boolean;
}

export interface ChosenVisitDate {
  /** The recommended day. */
  date: Date;
  /** How many visits are already booked that day (0 = a fresh day). */
  batchedWith: number;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Nudge a weekend date forward to the following Monday. */
function toWeekday(d: Date): Date {
  let x = startOfDay(d);
  while (isWeekend(x)) x = addDays(x, 1);
  return x;
}

export function chooseVisitDate(opts: ChooseVisitDateOptions): ChosenVisitDate {
  const avoidWeekends = opts.avoidWeekends ?? true;
  const today = startOfDay(opts.today);

  // Base: the due date, but never earlier than today.
  let base = startOfDay(opts.dueDate);
  if (base < today) base = today;
  if (avoidWeekends) base = toWeekday(base);

  const flex = Math.max(0, Math.round(opts.flexDays));

  // Gather candidate days within ±flex of the base that already have visits.
  // Prefer the one closest to the base date; break ties by the busier day.
  let best: { date: Date; batchedWith: number; distance: number } | null = null;
  for (let offset = -flex; offset <= flex; offset++) {
    const day = addDays(base, offset);
    if (day < today) continue;
    if (avoidWeekends && isWeekend(day)) continue;
    const count = opts.scheduledCountByDay.get(toDateKey(day)) ?? 0;
    if (count <= 0) continue;
    const distance = Math.abs(offset);
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && count > best.batchedWith)
    ) {
      best = { date: day, batchedWith: count, distance };
    }
  }

  if (best) return { date: best.date, batchedWith: best.batchedWith };
  return { date: base, batchedWith: 0 };
}
