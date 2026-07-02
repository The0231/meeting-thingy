import { prisma } from "@/lib/db";
import { readAudio } from "@/lib/storage";

// Stream a meeting's audio recording. Kept behind an API route so the raw
// uploads folder is never publicly served.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting?.audioFileUrl) {
    return new Response("Not found", { status: 404 });
  }
  const buf = await readAudio(meeting.audioFileUrl);
  if (!buf) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": meeting.audioMimeType || "application/octet-stream",
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
