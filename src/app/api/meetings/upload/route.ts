import type { NextRequest } from "next/server";
import { apiError, handleError, json } from "@/lib/api";
import { saveAudio } from "@/lib/storage";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) return apiError("No audio file provided", 400);

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) return apiError("Empty audio file", 400);
    if (buf.length > MAX_BYTES) return apiError("Audio file too large (max 25MB)", 413);

    const mime = file.type || "audio/webm";
    const name = await saveAudio(buf, mime);
    return json({ audioFileUrl: name, audioMimeType: mime });
  } catch (e) {
    return handleError(e);
  }
}
