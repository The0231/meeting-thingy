// AI helpers for meeting summarisation & action-point extraction (PRD §6.3).
// Uses Anthropic when ANTHROPIC_API_KEY is set; otherwise returns a graceful
// fallback so the rest of the app keeps working with no key configured.

import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

export interface MeetingInsights {
  summary: string;
  actionItems: string[];
  /** true when produced by the AI, false when it's a no-key fallback. */
  aiGenerated: boolean;
}

const SYSTEM_PROMPT = `You are an assistant that turns raw notes or a transcript from a sales/account meeting into a concise, useful record.
Return STRICT JSON only, with this exact shape:
{"summary": string, "actionItems": string[]}
- "summary": 2-4 short sentences capturing what was discussed, decisions, and the client's situation/interest.
- "actionItems": concrete follow-ups or promised next steps, each a short imperative phrase. Empty array if none.
Do not include any text outside the JSON.`;

/** Quick heuristic fallback when no AI key is configured. */
function fallbackInsights(text: string): MeetingInsights {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const summary = sentences.slice(0, 3).join(" ").slice(0, 600);
  // Pull lines that look like todos / follow-ups.
  const actionItems = clean
    .split(/[\n.;]+/)
    .map((s) => s.trim())
    .filter((s) =>
      /\b(follow up|call|send|email|schedule|book|prepare|quote|sample|next|remind|chase)\b/i.test(
        s,
      ),
    )
    .slice(0, 6);
  return {
    summary: summary || clean.slice(0, 600),
    actionItems,
    aiGenerated: false,
  };
}

export async function generateMeetingInsights(
  rawText: string,
): Promise<MeetingInsights> {
  const text = (rawText || "").trim();
  if (!text) return { summary: "", actionItems: [], aiGenerated: false };

  if (!config.aiSummaryEnabled) return fallbackInsights(text);

  try {
    const client = new Anthropic({ apiKey: config.ai.anthropicKey });
    const resp = await client.messages.create({
      model: config.ai.model,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Meeting notes / transcript:\n\n${text.slice(0, 12000)}`,
        },
      ],
    });

    const block = resp.content.find((b) => b.type === "text");
    const out = block && block.type === "text" ? block.text : "";
    const parsed = JSON.parse(extractJson(out));
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems.filter((x: unknown) => typeof x === "string")
        : [],
      aiGenerated: true,
    };
  } catch (err) {
    console.error("AI summary failed, using fallback:", err);
    return fallbackInsights(text);
  }
}

/** Tolerate a model that wraps JSON in prose or code fences. */
function extractJson(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) return s.slice(first, last + 1);
  return s.trim();
}

/**
 * Server-side transcription of an uploaded audio file via OpenAI Whisper.
 * Only used when OPENAI_API_KEY is set; live in-app recording transcribes for
 * free in the browser. Returns null when not configured or on failure.
 */
export async function transcribeAudio(
  audio: Blob,
  filename: string,
): Promise<string | null> {
  if (!config.serverTranscribeEnabled) return null;
  try {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model", config.ai.transcribeModel);
    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.ai.openaiKey}` },
      body: form,
    });
    if (!resp.ok) {
      console.error("Whisper transcription failed:", await resp.text());
      return null;
    }
    const data = (await resp.json()) as { text?: string };
    return data.text ?? null;
  } catch (err) {
    console.error("Transcription error:", err);
    return null;
  }
}
