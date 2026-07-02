// Server-side data access for meetings. Because the interval engine is
// stateless, creating/editing/deleting a meeting needs no extra recomputation —
// the next time a client is read its schedule is derived fresh.

import type { Meeting } from "@prisma/client";
import { prisma } from "./db";
import { autoLinkClientToPowerBi } from "./powerbi";
import type { MeetingDTO, MeetingStatus, MeetingType } from "./types";
import type { MeetingCreateInput } from "./validation";

function parseActionItems(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function buildMeetingDTO(
  meeting: Meeting & { client?: { clientName: string } | null },
  clientName?: string,
): MeetingDTO {
  return {
    id: meeting.id,
    clientId: meeting.clientId,
    clientName: clientName ?? meeting.client?.clientName ?? "",
    meetingDate: meeting.meetingDate.toISOString(),
    meetingType: meeting.meetingType as MeetingType,
    status: meeting.status as MeetingStatus,
    hasAudio: Boolean(meeting.audioFileUrl),
    audioMimeType: meeting.audioMimeType,
    transcript: meeting.transcript,
    aiSummary: meeting.aiSummary,
    manualNotes: meeting.manualNotes,
    actionItems: parseActionItems(meeting.actionItems),
    followUpRequired: meeting.followUpRequired,
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
  };
}

export interface MeetingFilter {
  clientId?: string;
  from?: Date;
  to?: Date;
  status?: MeetingStatus;
}

export async function getMeetings(filter: MeetingFilter = {}): Promise<MeetingDTO[]> {
  const meetings = await prisma.meeting.findMany({
    where: {
      clientId: filter.clientId,
      status: filter.status,
      meetingDate:
        filter.from || filter.to
          ? { gte: filter.from, lte: filter.to }
          : undefined,
    },
    include: { client: { select: { clientName: true } } },
    orderBy: { meetingDate: "desc" },
  });
  return meetings.map((m) => buildMeetingDTO(m));
}

export async function getMeeting(id: string): Promise<MeetingDTO | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { client: { select: { clientName: true } } },
  });
  return meeting ? buildMeetingDTO(meeting) : null;
}

export async function createMeeting(input: MeetingCreateInput): Promise<MeetingDTO> {
  const meeting = await prisma.meeting.create({
    data: {
      clientId: input.clientId,
      meetingDate: new Date(input.meetingDate),
      meetingType: input.meetingType ?? "in_person",
      status: input.status ?? "completed",
      transcript: input.transcript ?? null,
      aiSummary: input.aiSummary ?? null,
      manualNotes: input.manualNotes ?? null,
      actionItems: input.actionItems?.length
        ? JSON.stringify(input.actionItems)
        : null,
      followUpRequired: input.followUpRequired ?? false,
      audioFileUrl: input.audioFileUrl ?? null,
      audioMimeType: input.audioMimeType ?? null,
    },
    include: { client: { select: { clientName: true } } },
  });

  // Recording a meeting links its client to Power BI (name-matched, pulls the
  // yearly value in) so the visit schedule develops with real data. Fire and
  // forget — a Power BI hiccup must never block saving the meeting itself.
  if (meeting.status === "completed") {
    autoLinkClientToPowerBi(meeting.clientId).catch((e) =>
      console.warn("Power BI auto-link skipped:", e instanceof Error ? e.message : e),
    );
  }

  return buildMeetingDTO(meeting);
}

export async function updateMeeting(
  id: string,
  input: Partial<MeetingCreateInput>,
): Promise<MeetingDTO> {
  const data: Record<string, unknown> = {};
  if (input.meetingDate !== undefined) data.meetingDate = new Date(input.meetingDate);
  if (input.meetingType !== undefined) data.meetingType = input.meetingType;
  if (input.status !== undefined) data.status = input.status;
  if (input.transcript !== undefined) data.transcript = input.transcript ?? null;
  if (input.aiSummary !== undefined) data.aiSummary = input.aiSummary ?? null;
  if (input.manualNotes !== undefined) data.manualNotes = input.manualNotes ?? null;
  if (input.actionItems !== undefined)
    data.actionItems = input.actionItems?.length
      ? JSON.stringify(input.actionItems)
      : null;
  if (input.followUpRequired !== undefined)
    data.followUpRequired = input.followUpRequired;
  if (input.audioFileUrl !== undefined) data.audioFileUrl = input.audioFileUrl ?? null;
  if (input.audioMimeType !== undefined)
    data.audioMimeType = input.audioMimeType ?? null;

  const meeting = await prisma.meeting.update({
    where: { id },
    data,
    include: { client: { select: { clientName: true } } },
  });
  return buildMeetingDTO(meeting);
}

export async function deleteMeeting(id: string): Promise<void> {
  await prisma.meeting.delete({ where: { id } });
}
