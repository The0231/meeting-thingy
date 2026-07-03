// Plain-assertion tests for the smart-interval engine & scheduler.
// Run: npx tsx scripts/test-engine.ts   (exits non-zero on failure)

import { estimateInterval, humanIntervalLabel, detectIntervalShift, type IntervalEstimate } from "../src/lib/interval";
import { computeSchedule } from "../src/lib/reminders";
import { chooseVisitDate } from "../src/lib/suggest";
import { toDateKey } from "../src/lib/dates";
import { detectSalesAlerts, type MonthlySales } from "../src/lib/sales-health";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

const DAY = 86400000;
const EPOCH = new Date(2024, 0, 1).getTime();
// Build meeting dates from a list of gaps (days between consecutive meetings).
function datesFromGaps(gaps: number[]): Date[] {
  let t = EPOCH;
  const dates = [new Date(t)];
  for (const g of gaps) {
    t += g * DAY;
    dates.push(new Date(t));
  }
  return dates;
}

console.log("Interval estimation");
{
  const e = estimateInterval(datesFromGaps([30, 30]));
  check("3 monthly meetings -> 30d", e.estimatedDays === 30, `got ${e.estimatedDays}`);
  check("3 monthly meetings -> 'Monthly'", e.label === "Monthly", e.label);

  const two = estimateInterval(datesFromGaps([31]));
  check("2 meetings -> ~31d", two.estimatedDays === 31, `got ${two.estimatedDays}`);
  check("2 meetings -> low confidence", two.confidence === "low", two.confidence);

  const one = estimateInterval(datesFromGaps([]));
  check("1 meeting -> null estimate", one.estimatedDays === null);
  check("1 meeting -> low confidence", one.confidence === "low");

  const none = estimateInterval([]);
  check("0 meetings -> null estimate", none.estimatedDays === null);

  const weekly = estimateInterval(datesFromGaps([7, 7, 7]));
  check("weekly -> 'Weekly'", weekly.label === "Weekly", weekly.label);
  const bimonthly = estimateInterval(datesFromGaps([60, 60, 61]));
  check("60d -> 'Every 2 months'", bimonthly.label === "Every 2 months", bimonthly.label);
}

console.log("Gradual adjustment (headline feature)");
{
  // Monthly history, then the rhythm slows to ~60d. Should drift, not jump.
  const step1 = estimateInterval(datesFromGaps([30, 30, 30, 60]));
  check("after first long gap: between 30 and 60 (gradual)",
    step1.estimatedDays! > 30 && step1.estimatedDays! < 60, `got ${step1.estimatedDays}`);

  const step2 = estimateInterval(datesFromGaps([30, 30, 30, 60, 60]));
  check("after second long gap: moves further toward 60",
    step2.estimatedDays! > step1.estimatedDays!, `${step1.estimatedDays} -> ${step2.estimatedDays}`);

  const step4 = estimateInterval(datesFromGaps([30, 60, 60, 60, 60]));
  const step5 = estimateInterval(datesFromGaps([60, 60, 60, 60, 60]));
  check("converges to 60 once the pattern is consistent",
    step5.estimatedDays === 60, `got ${step5.estimatedDays}`);
  check("monotonic-ish drift toward new pace", step4.estimatedDays! >= step2.estimatedDays!);

  // Newest gap carries more weight than older ones.
  const recentHeavier = estimateInterval(datesFromGaps([30, 30, 60]));
  const recentLighter = estimateInterval(datesFromGaps([60, 30, 30]));
  check("recent gaps weigh more than old ones",
    recentHeavier.estimatedDays! > recentLighter.estimatedDays!,
    `${recentLighter.estimatedDays} vs ${recentHeavier.estimatedDays}`);
}

console.log("Outlier robustness");
{
  // A single freak gap among a steady run should be ignored (needs >=4 gaps).
  const withOutlier = estimateInterval(datesFromGaps([30, 30, 30, 120, 30]));
  check("single freak gap ignored -> stays ~30",
    withOutlier.estimatedDays === 30, `got ${withOutlier.estimatedDays}`);
  check("outlier recorded", withOutlier.outliersRemoved.includes(120));
}

console.log("Interval shift detection");
{
  const shift = detectIntervalShift(datesFromGaps([30, 30, 30, 60]));
  check("detects monthly -> slower shift", shift.changed === true, JSON.stringify(shift));
  const steady = detectIntervalShift(datesFromGaps([30, 30, 30, 30]));
  check("no false positive on steady rhythm", steady.changed === false);
}

console.log("Human labels");
{
  check("7 -> Weekly", humanIntervalLabel(7) === "Weekly");
  check("30 -> Monthly", humanIntervalLabel(30) === "Monthly");
  check("60 -> Every 2 months", humanIntervalLabel(60) === "Every 2 months");
  check("182 -> 'Twice a year'", humanIntervalLabel(182) === "Twice a year", humanIntervalLabel(182));
  check("250 -> 'Every 250 days'", humanIntervalLabel(250) === "Every 250 days", humanIntervalLabel(250));
  check("null -> not enough data", humanIntervalLabel(null) === "Not enough data");
}

console.log("Scheduling & reminder states");
{
  const TODAY = new Date(2026, 5, 30); // 30 Jun 2026, local
  const est = (days: number | null): IntervalEstimate => ({
    estimatedDays: days, label: humanIntervalLabel(days), confidence: "high",
    confidenceScore: 0.8, basedOnMeetings: 4, observedIntervals: [], usedIntervals: [], outliersRemoved: [],
  });
  const base = {
    manualIntervalDays: null as number | null,
    customNextDate: null as Date | null,
    clientPaused: false,
    defaultIntervalDays: 30,
    dueSoonLeadDays: 7,
    today: TODAY,
  };
  const at = (daysAgo: number) => new Date(TODAY.getTime() - daysAgo * DAY);

  const overdue = computeSchedule({ ...base, intervalMode: "automatic", estimate: est(30), completedMeetingDates: [at(31)] });
  check("overdue when next date passed", overdue.reminderState === "overdue", overdue.reminderState);
  check("overdue days computed", overdue.daysOverdue === 1, `${overdue.daysOverdue}`);

  const dueToday = computeSchedule({ ...base, intervalMode: "automatic", estimate: est(30), completedMeetingDates: [at(30)] });
  check("due today at exactly the interval", dueToday.reminderState === "due_today", dueToday.reminderState);

  const soon = computeSchedule({ ...base, intervalMode: "automatic", estimate: est(30), completedMeetingDates: [at(25)] });
  check("due soon within lead window", soon.reminderState === "upcoming", soon.reminderState);

  const onTrack = computeSchedule({ ...base, intervalMode: "automatic", estimate: est(30), completedMeetingDates: [at(5)] });
  check("on track when far from due", onTrack.reminderState === "recent", onTrack.reminderState);

  const noHistory = computeSchedule({ ...base, intervalMode: "automatic", estimate: est(null), completedMeetingDates: [] });
  check("no history when no meetings", noHistory.reminderState === "no_history", noHistory.reminderState);
  check("no-history falls back to default interval", noHistory.effectiveIntervalDays === 30 && noHistory.intervalSource === "default");

  const paused = computeSchedule({ ...base, clientPaused: true, intervalMode: "paused", estimate: est(30), completedMeetingDates: [at(100)] });
  check("paused suppresses reminders", paused.reminderState === "paused" && paused.nextSuggestedDate === null);

  const manual = computeSchedule({ ...base, intervalMode: "manual", manualIntervalDays: 14, estimate: est(30), completedMeetingDates: [at(20)] });
  check("manual interval overrides learned", manual.intervalSource === "manual" && manual.effectiveIntervalDays === 14);
  check("manual overdue (20d since, 14d interval)", manual.reminderState === "overdue", manual.reminderState);

  const custom = computeSchedule({ ...base, intervalMode: "custom_date", customNextDate: new Date(TODAY.getTime() + 3 * DAY), estimate: est(30), completedMeetingDates: [at(40)] });
  check("custom date drives schedule", custom.intervalSource === "custom_date" && custom.reminderState === "upcoming", custom.reminderState);
}

console.log("Suggested visit date (batching + weekday)");
{
  // 2024-01-01 is a Monday. 08 Mon, 09 Tue, 10 Wed, 12 Fri, 13 Sat, 15 Mon.
  const today0 = new Date(2024, 0, 8);
  const noneSched = new Map<string, number>();

  const past = chooseVisitDate({
    dueDate: new Date(2024, 0, 1),
    today: today0,
    flexDays: 6,
    scheduledCountByDay: noneSched,
  });
  check("never suggests a past date", toDateKey(past.date) === "2024-01-08", toDateKey(past.date));

  const sched = new Map<string, number>([["2024-01-09", 2]]);
  const batched = chooseVisitDate({
    dueDate: new Date(2024, 0, 10),
    today: today0,
    flexDays: 6,
    scheduledCountByDay: sched,
  });
  check(
    "batches onto a nearby booked day",
    toDateKey(batched.date) === "2024-01-09" && batched.batchedWith === 2,
    `${toDateKey(batched.date)} x${batched.batchedWith}`,
  );

  const wknd = chooseVisitDate({
    dueDate: new Date(2024, 0, 13),
    today: today0,
    flexDays: 6,
    scheduledCountByDay: noneSched,
  });
  check("weekend due date rolls to Monday", toDateKey(wknd.date) === "2024-01-15", toDateKey(wknd.date));

  const far = new Map<string, number>([["2024-01-30", 3]]);
  const noBatch = chooseVisitDate({
    dueDate: new Date(2024, 0, 10),
    today: today0,
    flexDays: 6,
    scheduledCountByDay: far,
  });
  check(
    "ignores booked days outside the flex window",
    toDateKey(noBatch.date) === "2024-01-10" && noBatch.batchedWith === 0,
    toDateKey(noBatch.date),
  );
}

console.log("Sales-health alerts (Power BI signals)");
{
  const SALES_TODAY = new Date(2026, 6, 15); // 15 Jul 2026
  const ms = (
    monthsAgo: number,
    revenue: number,
    categories?: Record<string, number>,
  ): MonthlySales => ({
    periodStart: new Date(2026, 6 - monthsAgo, 1),
    revenue,
    units: null,
    categories: categories ?? null,
  });

  const drop = detectSalesAlerts(
    [ms(8, 8000), ms(7, 8000), ms(6, 8000), ms(5, 8000), ms(4, 8000), ms(3, 3500), ms(2, 3400), ms(1, 3300)],
    { today: SALES_TODAY },
  );
  check("volume drop detected", drop.some((a) => a.type === "volume_drop"), JSON.stringify(drop.map((a) => a.type)));
  check("volume drop is high severity", drop.some((a) => a.type === "volume_drop" && a.severity === "high"));

  const stopped = detectSalesAlerts(
    [ms(8, 600), ms(7, 600), ms(6, 600), ms(5, 600), ms(4, 600), ms(3, 600)],
    { today: SALES_TODAY },
  );
  check("stopped ordering detected (staleness)", stopped.some((a) => a.type === "stopped_ordering"), JSON.stringify(stopped.map((a) => a.type)));

  const shift = detectSalesAlerts(
    [
      ms(8, 1700, { "Fresh Pasta": 1500, Gnocchi: 200 }),
      ms(7, 1700, { "Fresh Pasta": 1500, Gnocchi: 200 }),
      ms(6, 1700, { "Fresh Pasta": 1500, Gnocchi: 200 }),
      ms(5, 1700, { "Fresh Pasta": 1500, Gnocchi: 200 }),
      ms(4, 1700, { "Fresh Pasta": 1500, Gnocchi: 200 }),
      ms(3, 1700, { "Fresh Pasta": 100, Gnocchi: 1600 }),
      ms(2, 1700, { "Fresh Pasta": 100, Gnocchi: 1600 }),
      ms(1, 1700, { "Fresh Pasta": 100, Gnocchi: 1600 }),
    ],
    { today: SALES_TODAY },
  );
  check("product shift detected", shift.some((a) => a.type === "product_shift"), JSON.stringify(shift.map((a) => a.type)));
  check("flat spend is not flagged as a drop", !shift.some((a) => a.type === "volume_drop"));

  const healthy = detectSalesAlerts(
    [ms(6, 10000), ms(5, 10200), ms(4, 9900), ms(3, 10000), ms(2, 10100), ms(1, 9950)],
    { today: SALES_TODAY },
  );
  check("no alerts for a steady client", healthy.length === 0, JSON.stringify(healthy.map((a) => a.type)));

  const thin = detectSalesAlerts([ms(2, 500), ms(1, 500)], { today: SALES_TODAY });
  check("no alert on thin history", thin.length === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
