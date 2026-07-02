import type { NextRequest } from "next/server";
import { handleError, json } from "@/lib/api";
import { generateMeetingInsights } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text : "";
    const insights = await generateMeetingInsights(text);
    return json(insights);
  } catch (e) {
    return handleError(e);
  }
}
