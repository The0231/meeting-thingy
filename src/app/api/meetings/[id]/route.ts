import type { NextRequest } from "next/server";
import { apiError, handleError, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { deleteMeeting, getMeeting, updateMeeting } from "@/lib/meetings";
import { deleteAudio } from "@/lib/storage";
import { meetingUpdateSchema } from "@/lib/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const meeting = await getMeeting(id);
    if (!meeting) return apiError("Meeting not found", 404);
    return json({ meeting });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const input = meetingUpdateSchema.parse(body);
    const meeting = await updateMeeting(id, input);
    return json({ meeting });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Clean up the audio file too, if any.
    const existing = await prisma.meeting.findUnique({ where: { id } });
    if (existing?.audioFileUrl) await deleteAudio(existing.audioFileUrl);
    await deleteMeeting(id);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
