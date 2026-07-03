// Server-side data access for clients. Every read recomputes the derived
// scheduling fields (learned interval, next suggested date, reminder state)
// from meeting history — nothing scheduling-related is stored, so edits to
// meetings are always reflected correctly.

import type { Client, Meeting } from "@prisma/client";
import { config } from "./config";
import { prisma } from "./db";
import { estimateInterval, humanIntervalLabel } from "./interval";
import { computePriority } from "./priority";
import { computeSchedule } from "./reminders";
import type { ClientDTO, IntervalMode, ReminderState, ValueSource } from "./types";
import type { ClientCreateInput } from "./validation";

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function buildClientDTO(
  client: Client,
  meetings: Meeting[],
): ClientDTO {
  const completed = meetings.filter((m) => m.status === "completed");
  const completedDates = completed.map((m) => m.meetingDate);

  const estimate = estimateInterval(completedDates, {
    windowSize: config.intervalWindow,
  });

  const schedule = computeSchedule({
    intervalMode: client.intervalMode as IntervalMode,
    manualIntervalDays: client.manualIntervalDays,
    customNextDate: client.customNextDate,
    expectedIntervalDays: client.expectedIntervalDays,
    snoozedUntil: client.snoozedUntil,
    clientPaused: client.intervalMode === "paused",
    completedMeetingDates: completedDates,
    estimate,
    defaultIntervalDays: config.defaultIntervalDays,
    dueSoonLeadDays: config.dueSoonLeadDays,
  });

  const priority = computePriority(
    {
      reminderState: schedule.reminderState,
      effectiveIntervalDays: schedule.effectiveIntervalDays,
      daysUntilDue: schedule.daysUntilDue,
      annualValue: client.annualValue,
    },
    { valueReference: config.priorityValueReference },
  );

  let intervalLabel: string;
  if (schedule.intervalSource === "custom_date") intervalLabel = "Custom date";
  else if (schedule.intervalSource === "paused") intervalLabel = "Paused";
  else if (schedule.intervalSource === "expected")
    intervalLabel = `${humanIntervalLabel(schedule.effectiveIntervalDays)} (your estimate)`;
  else intervalLabel = humanIntervalLabel(schedule.effectiveIntervalDays);

  return {
    id: client.id,
    clientName: client.clientName,
    businessName: client.businessName,
    contactName: client.contactName,
    phone: client.phone,
    email: client.email,
    notes: client.notes,
    tags: parseTags(client.tags),
    intervalMode: client.intervalMode as IntervalMode,
    manualIntervalDays: client.manualIntervalDays,
    customNextDate: client.customNextDate?.toISOString() ?? null,
    setupCompleted: client.setupCompleted,
    expectedIntervalDays: client.expectedIntervalDays,
    snoozedUntil: client.snoozedUntil?.toISOString() ?? null,
    snoozeReason: client.snoozeReason,
    annualValue: client.annualValue,
    valueSource: (client.valueSource as ValueSource | null) ?? null,
    powerBiName: client.powerBiName,
    powerBiSyncedAt: client.powerBiSyncedAt?.toISOString() ?? null,
    salesRep: client.salesRep,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    meetingCount: completed.length,
    lastMeetingDate: schedule.lastMeetingDate?.toISOString() ?? null,
    nextSuggestedDate: schedule.nextSuggestedDate?.toISOString() ?? null,
    effectiveIntervalDays: schedule.effectiveIntervalDays,
    intervalSource: schedule.intervalSource,
    intervalLabel,
    reminderState: schedule.reminderState,
    daysUntilDue: schedule.daysUntilDue,
    daysOverdue: schedule.daysOverdue,
    confidence: estimate.confidence,
    confidenceScore: estimate.confidenceScore,
    learnedIntervalDays: estimate.estimatedDays,
    priorityScore: priority.score,
    priorityLevel: priority.level,
  };
}

// Lower number = more urgent (used for default sorting on dashboards/lists).
const STATE_RANK: Record<ReminderState, number> = {
  overdue: 0,
  due_today: 1,
  upcoming: 2,
  no_history: 3,
  recent: 4,
  paused: 5,
};

export function compareByUrgency(a: ClientDTO, b: ClientDTO): number {
  const r = STATE_RANK[a.reminderState] - STATE_RANK[b.reminderState];
  if (r !== 0) return r;
  // Within the same state, the more overdue / sooner-due come first.
  const ad = a.daysUntilDue ?? Number.POSITIVE_INFINITY;
  const bd = b.daysUntilDue ?? Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;
  return a.clientName.localeCompare(b.clientName);
}

// Default list order: visit priority (overdue-ness × value × rhythm) first,
// urgency state as the tie-breaker.
export function compareByPriorityThenUrgency(a: ClientDTO, b: ClientDTO): number {
  if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
  return compareByUrgency(a, b);
}

export interface ClientFilter {
  search?: string;
  state?: ReminderState;
  tag?: string;
  intervalMode?: IntervalMode;
}

export async function getClients(filter: ClientFilter = {}): Promise<ClientDTO[]> {
  const clients = await prisma.client.findMany({
    include: { meetings: true },
    orderBy: { clientName: "asc" },
  });

  let dtos = clients.map((c) => buildClientDTO(c, c.meetings));

  if (filter.search) {
    const q = filter.search.toLowerCase();
    dtos = dtos.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        (c.businessName ?? "").toLowerCase().includes(q) ||
        (c.contactName ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }
  if (filter.state) dtos = dtos.filter((c) => c.reminderState === filter.state);
  if (filter.tag) dtos = dtos.filter((c) => c.tags.includes(filter.tag!));
  if (filter.intervalMode)
    dtos = dtos.filter((c) => c.intervalMode === filter.intervalMode);

  return dtos.sort(compareByPriorityThenUrgency);
}

export async function getClient(id: string): Promise<ClientDTO | null> {
  const client = await prisma.client.findUnique({
    where: { id },
    include: { meetings: true },
  });
  if (!client) return null;
  return buildClientDTO(client, client.meetings);
}

function toTagString(tags?: string[] | null): string | null {
  if (!tags || tags.length === 0) return null;
  return tags.map((t) => t.trim()).filter(Boolean).join(",");
}

export async function createClient(input: ClientCreateInput): Promise<ClientDTO> {
  const client = await prisma.client.create({
    data: {
      clientName: input.clientName,
      businessName: input.businessName ?? null,
      contactName: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
      tags: toTagString(input.tags),
      intervalMode: input.intervalMode ?? "automatic",
      manualIntervalDays: input.manualIntervalDays ?? null,
      customNextDate: input.customNextDate ? new Date(input.customNextDate) : null,
      setupCompleted: input.setupCompleted ?? input.expectedIntervalDays != null,
      expectedIntervalDays: input.expectedIntervalDays ?? null,
      annualValue: input.annualValue ?? null,
      valueSource: input.annualValue != null ? "manual" : null,
    },
    include: { meetings: true },
  });
  return buildClientDTO(client, client.meetings);
}

export async function updateClient(
  id: string,
  input: Partial<ClientCreateInput>,
): Promise<ClientDTO> {
  const data: Record<string, unknown> = {};
  if (input.clientName !== undefined) data.clientName = input.clientName;
  if (input.businessName !== undefined) data.businessName = input.businessName ?? null;
  if (input.contactName !== undefined) data.contactName = input.contactName ?? null;
  if (input.phone !== undefined) data.phone = input.phone ?? null;
  if (input.email !== undefined) data.email = input.email ?? null;
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  if (input.tags !== undefined) data.tags = toTagString(input.tags);
  if (input.intervalMode !== undefined) data.intervalMode = input.intervalMode;
  if (input.manualIntervalDays !== undefined)
    data.manualIntervalDays = input.manualIntervalDays ?? null;
  if (input.customNextDate !== undefined)
    data.customNextDate = input.customNextDate ? new Date(input.customNextDate) : null;
  if (input.setupCompleted !== undefined) data.setupCompleted = input.setupCompleted;
  if (input.expectedIntervalDays !== undefined)
    data.expectedIntervalDays = input.expectedIntervalDays ?? null;
  if (input.annualValue !== undefined) {
    data.annualValue = input.annualValue ?? null;
    // A manual edit takes over from Power BI until the next sync relinks it.
    data.valueSource = input.annualValue != null ? "manual" : null;
  }

  const client = await prisma.client.update({
    where: { id },
    data,
    include: { meetings: true },
  });
  return buildClientDTO(client, client.meetings);
}

export async function deleteClient(id: string): Promise<void> {
  await prisma.client.delete({ where: { id } });
}
