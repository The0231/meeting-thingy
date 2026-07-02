// Local filesystem storage for meeting audio recordings. Files live in
// ./uploads (git-ignored) and are streamed back through /api/audio/[id] so the
// raw folder is never publicly served.

import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export function extForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "bin";
}

export async function saveAudio(buffer: Buffer, mime: string): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = extForMime(mime);
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return name;
}

export async function readAudio(name: string): Promise<Buffer | null> {
  try {
    // basename() defends against path traversal (e.g. "../../etc/passwd").
    const safe = path.basename(name);
    return await fs.readFile(path.join(UPLOAD_DIR, safe));
  } catch {
    return null;
  }
}

export async function deleteAudio(name: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(name)));
  } catch {
    /* ignore missing file */
  }
}
