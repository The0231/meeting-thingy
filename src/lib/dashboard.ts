// Aggregates everything the dashboard needs in a single DB read.

import { config } from "./config";
import { prisma } from "./db";
import { detectIntervalShift } from "./interval";
import { buildClientDTO, compareByPriorityThenUrgency } from "./clients";
import { buildMeetingDTO } from "./meetings";
import type { ClientDTO, MeetingDTO } from "./types";

export interface IntervalChange {
  client: ClientDTO;
  fromLabel: string;
  toLabel: string;
}

export interface DashboardData {
  totals: {
    clients: number;
    overdue: number;
    dueSoon: number; // upcoming + due_today
    onTrack: number;
    noHistory: number;
    paused: number;
  };
  overdue: ClientDTO[];
  dueSoon: ClientDTO[];
  recentlyMet: ClientDTO[];
  noHistory: ClientDTO[];
  intervalChanged: IntervalChange[];
  upcomingMeetings: MeetingDTO[];
  recentMeetings: MeetingDTO[];
}

export async function getDashboard(): Promise<DashboardData> {
  const clients = await prisma.client.findMany({
    include: { meetings: true },
  });

  // Priority order (overdue-ness relative to rhythm × value × frequency), so
  // "needs attention" reads top-to-bottom as "visit these first".
  const dtos = clients
    .map((c) => buildClientDTO(c, c.meetings))
    .sort(compareByPriorityThenUrgency);

  const overdue = dtos.filter((c) => c.reminderState === "overdue");
  const dueSoon = dtos.filter(
    (c) => c.reminderState === "upcoming" || c.reminderState === "due_today",
  );
  const noHistory = dtos.filter((c) => c.reminderState === "no_history");
  const paused = dtos.filter((c) => c.reminderState === "paused");
  const onTrack = dtos.filter((c) => c.reminderState === "recent");

  const recentlyMet = [...onTrack]
    .filter((c) => c.lastMeetingDate)
    .sort((a, b) => (b.lastMeetingDate! > a.lastMeetingDate! ? 1 : -1))
    .slice(0, 8);

  // Interval-shift detection
  const intervalChanged: IntervalChange[] = [];
  for (const c of clients) {
    const completedDates = c.meetings
      .filter((m) => m.status === "completed")
      .map((m) => m.meetingDate);
    const shift = detectIntervalShift(completedDates, {
      windowSize: config.intervalWindow,
    });
    if (shift.changed) {
      const dto = dtos.find((d) => d.id === c.id);
      if (dto)
        intervalChanged.push({
          client: dto,
          fromLabel: shift.fromLabel,
          toLabel: shift.toLabel,
        });
    }
  }

  const now = new Date();

  const upcomingRows = await prisma.meeting.findMany({
    where: { status: "scheduled", meetingDate: { gte: now } },
    include: { client: { select: { clientName: true } } },
    orderBy: { meetingDate: "asc" },
    take: 8,
  });
  const recentRows = await prisma.meeting.findMany({
    where: { status: "completed", meetingDate: { lte: now } },
    include: { client: { select: { clientName: true } } },
    orderBy: { meetingDate: "desc" },
    take: 8,
  });

  return {
    totals: {
      clients: dtos.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      onTrack: onTrack.length,
      noHistory: noHistory.length,
      paused: paused.length,
    },
    overdue,
    dueSoon,
    recentlyMet,
    noHistory,
    intervalChanged,
    upcomingMeetings: upcomingRows.map((m) => buildMeetingDTO(m)),
    recentMeetings: recentRows.map((m) => buildMeetingDTO(m)),
  };
}
