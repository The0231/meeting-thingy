import type { NextRequest } from "next/server";
import { apiError, handleError, json } from "@/lib/api";
import { config } from "@/lib/config";
import { transcribeAudio } from "@/lib/ai";

// Server-side transcription of an uploaded recording (OpenAI Whisper).
// Live in-app recording transcribes for free in the browser, so this is only
// needed for uploaded files when an OpenAI key is configured.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) return apiError("No audio file provided", 400);

    if (!config.serverTranscribeEnabled) {
      return json({
        transcript: null,
        error:
          "Server transcription isn't configured (no OpenAI key). Use live recording or type the notes.",
      });
    }

    const text = await transcribeAudio(file, "recording.webm");
    if (!text) return json({ transcript: null, error: "Transcription failed." });
    return json({ transcript: text });
  } catch (e) {
    return handleError(e);
  }
}
