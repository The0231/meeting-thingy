import type { NextRequest } from "next/server";
import { handleError, json } from "@/lib/api";
import { createMeeting, getMeetings, type MeetingFilter } from "@/lib/meetings";
import { meetingCreateSchema } from "@/lib/validation";
import type { MeetingStatus } from "@/lib/types";

/** Parse a date query param; ignore it (undefined) if malformed. */
function parseDateParam(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filter: MeetingFilter = {
      clientId: sp.get("clientId") || undefined,
      status: (sp.get("status") as MeetingStatus) || undefined,
      from: parseDateParam(sp.get("from")),
      to: parseDateParam(sp.get("to")),
    };
    const meetings = await getMeetings(filter);
    return json({ meetings });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = meetingCreateSchema.parse(body);
    const meeting = await createMeeting(input);
    return json({ meeting }, 201);
  } catch (e) {
    return handleError(e);
  }
}
