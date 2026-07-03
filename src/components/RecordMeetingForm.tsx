"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Mic,
  Search,
  Sparkles,
  Square,
  Upload,
  Save,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { parseFrequencyDays } from "@/lib/frequency";
import { MEETING_TYPES, LABELS } from "@/lib/types";

interface ClientOption {
  id: string;
  clientName: string;
  setupCompleted: boolean;
  expectedIntervalDays: number | null;
  annualValue: number | null;
  valueSource: string | null;
  meetingCount: number;
}

interface ClientMatch {
  clientId: string;
  clientName: string;
  score: number;
}

// A customer from the live Power BI directory (not yet a calendar client).
interface PbiMatch {
  name: string;
  value: number | null;
  rep: string | null;
  score: number;
}

function fmtValueShort(v: number | null): string {
  if (v == null) return "";
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `£${Math.round(v / 1_000)}k`;
  return `£${Math.round(v)}`;
}

// First-visit setup: "how often do you normally visit this client?"
const RHYTHM_OPTIONS = [
  { value: "7", label: "Every week" },
  { value: "14", label: "Every 2 weeks" },
  { value: "21", label: "Every 3 weeks" },
  { value: "30", label: "Every month" },
  { value: "42", label: "Every 6 weeks" },
  { value: "60", label: "Every 2 months" },
  { value: "91", label: "Every 3 months" },
  { value: "182", label: "Twice a year" },
  { value: "custom", label: "Something else…" },
  { value: "learn", label: "Not sure — learn from my visits" },
];

// Minimal typings for the browser SpeechRecognition API (not in lib.dom).
type SpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
          {n}
        </span>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      {hint && <p className="ml-[34px] mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function RecordMeetingForm({
  clients,
  preselectedClientId,
  meetingId,
  defaultDate,
}: {
  clients: ClientOption[];
  preselectedClientId?: string;
  // When set, we're logging an existing booked visit: save COMPLETES that
  // meeting instead of creating a new one (avoids a duplicate).
  meetingId?: string;
  defaultDate?: string; // yyyy-MM-dd, e.g. the booked date
}) {
  const router = useRouter();

  const [clientId, setClientId] = useState(preselectedClientId ?? "");
  const [meetingDate, setMeetingDate] = useState(
    () => defaultDate || new Date().toISOString().slice(0, 10),
  );
  const [meetingType, setMeetingType] = useState("in_person");

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [summary, setSummary] = useState("");
  const [actionText, setActionText] = useState("");

  const [summarising, setSummarising] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Spoken-name matching ("who is this meeting with?" from the transcript).
  const [matching, setMatching] = useState(false);
  const [matchSuggestions, setMatchSuggestions] = useState<ClientMatch[]>([]);
  const [pbiSuggestions, setPbiSuggestions] = useState<PbiMatch[]>([]);

  // Client picker: live search over calendar clients AND the Power BI
  // customer directory — meetings must link to a real customer.
  const [clientList, setClientList] = useState<ClientOption[]>(clients);
  const [clientQuery, setClientQuery] = useState(
    () => clients.find((c) => c.id === preselectedClientId)?.clientName ?? "",
  );
  const [searchResults, setSearchResults] = useState<{ matches: ClientMatch[]; powerbi: PbiMatch[] } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced directory search as the rep types.
  useEffect(() => {
    if (!searchOpen) return;
    const q = clientQuery.trim();
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/clients/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: q }),
        });
        const data = await res.json();
        if (res.ok) setSearchResults({ matches: data.matches ?? [], powerbi: data.powerbi ?? [] });
      } catch {
        /* keep previous results */
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientQuery, searchOpen]);

  // First-visit setup answers (shown when the chosen client hasn't been set up).
  const [rhythmChoice, setRhythmChoice] = useState("");
  const [customDays, setCustomDays] = useState("");
  const [valueInput, setValueInput] = useState("");

  const selectedClient = clientList.find((c) => c.id === clientId) ?? null;
  const needsSetup = selectedClient != null && !selectedClient.setupCompleted;

  // If the rep already SAID how often they meet ("I see them every week"),
  // fill the setup answer from the notes automatically.
  useEffect(() => {
    if (!needsSetup || rhythmChoice) return;
    const days = parseFrequencyDays(transcript);
    if (!days) return;
    const preset = RHYTHM_OPTIONS.find((o) => o.value === String(days));
    if (preset) {
      setRhythmChoice(preset.value);
    } else {
      setRhythmChoice("custom");
      setCustomDays(String(days));
    }
    setNotice(
      `Picked up from your notes: you meet them about every ${days === 7 ? "week" : days + " days"} — change it below if that's wrong.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, needsSetup]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const mimeRef = useRef<string>("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalRef = useRef<string>("");
  const audioUrlRef = useRef<string | null>(null);

  // Capability flags start false so the first client render matches the server
  // HTML (avoids a hydration mismatch); resolved after mount.
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recordSupported, setRecordSupported] = useState(false);

  useEffect(() => {
    setSpeechSupported(
      typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
    );
    setRecordSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  // Track the current object URL in a ref so the unmount cleanup can revoke it
  // (an empty-deps cleanup would otherwise capture the initial null).
  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  useEffect(() => {
    // Prefill the setup answers (e.g. a Power BI-synced value) when arriving
    // with a client already chosen via /record?clientId=…
    const c = clients.find((x) => x.id === preselectedClientId);
    if (c?.annualValue != null) setValueInput(String(Math.round(c.annualValue)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.stop();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  function selectClient(id: string, list?: ClientOption[]) {
    setClientId(id);
    setMatchSuggestions([]);
    setPbiSuggestions([]);
    setSearchOpen(false);
    const c = (list ?? clientList).find((x) => x.id === id);
    if (c) setClientQuery(c.clientName);
    setRhythmChoice("");
    setCustomDays("");
    setValueInput(c?.annualValue != null ? String(Math.round(c.annualValue)) : "");
  }

  /** A Power BI customer was picked — create the linked calendar client. */
  async function pickPowerBi(pbiName: string) {
    setLinking(true);
    setError(null);
    try {
      const res = await fetch("/api/clients/from-powerbi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ powerBiName: pbiName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't link the customer.");
      const c = data.client;
      const option: ClientOption = {
        id: c.id,
        clientName: c.clientName,
        setupCompleted: c.setupCompleted,
        expectedIntervalDays: c.expectedIntervalDays,
        annualValue: c.annualValue,
        valueSource: c.valueSource,
        meetingCount: c.meetingCount,
      };
      const nextList = [option, ...clientList.filter((x) => x.id !== option.id)];
      setClientList(nextList);
      selectClient(option.id, nextList);
      setNotice(
        `${c.clientName} linked from Power BI${c.salesRep ? ` (${c.salesRep}'s customer)` : ""}.` +
          (!c.setupCompleted ? " Quick setup below — one time only." : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't link the customer.");
    } finally {
      setLinking(false);
    }
  }

  /** Fuzzy-match the transcript against calendar clients AND the Power BI
   *  customer directory. Auto-picks a confident match; otherwise shows
   *  suggestions and asks the rep to type/spell the name. */
  async function matchClientFromText(text: string, auto = false) {
    if (!text.trim()) {
      if (!auto) setNotice("Record or type some notes first, then I can find the client.");
      return;
    }
    setMatching(true);
    if (!auto) setError(null);
    try {
      const res = await fetch("/api/clients/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const matches: ClientMatch[] = res.ok ? data.matches ?? [] : [];
      const powerbi: PbiMatch[] = res.ok ? data.powerbi ?? [] : [];

      if (matches.length > 0 && matches[0].score >= 0.85) {
        selectClient(matches[0].clientId);
        setNotice(
          `Matched to ${matches[0].clientName} (${Math.round(matches[0].score * 100)}% sure) — change it if that's wrong.`,
        );
      } else if (
        powerbi.length > 0 &&
        powerbi[0].score >= 0.88 &&
        (matches.length === 0 || powerbi[0].score > matches[0].score) &&
        // Never guess between near-identical customers (e.g. three different
        // "Marks & Spencer" accounts) — ask instead.
        (powerbi.length === 1 || powerbi[0].score - powerbi[1].score >= 0.05)
      ) {
        // Confident, unambiguous hit in the Power BI customer list — link it.
        await pickPowerBi(powerbi[0].name);
      } else if (matches.length > 0 || powerbi.length > 0) {
        setMatchSuggestions(matches.slice(0, 3));
        setPbiSuggestions(powerbi.slice(0, 3));
        setNotice(
          "I couldn't confidently match the client — tap the right one below, or type the name in the search box (spell it out if it's unusual).",
        );
      } else {
        setNotice(
          "No customer matched what was said. Type the client's name in the search box — it looks through the whole Power BI customer list.",
        );
      }
    } catch {
      if (!auto) setError("Client matching failed.");
    } finally {
      setMatching(false);
    }
  }

  async function startRecording() {
    setError(null);
    setNotice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickAudioMime();
      mimeRef.current = mime || "audio/webm";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        blobRef.current = blob;
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
      };
      mr.start();
      mediaRecorderRef.current = mr;

      // Live transcription (free, in-browser) when supported.
      if (speechSupported) {
        const Ctor =
          (window as unknown as { SpeechRecognition?: new () => SpeechRecognition })
            .SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition })
            .webkitSpeechRecognition;
        if (Ctor) {
          const rec = new Ctor();
          rec.lang = "en-GB";
          rec.continuous = true;
          rec.interimResults = true;
          finalRef.current = transcript ? transcript + " " : "";
          rec.onresult = (e) => {
            let interimText = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const r = e.results[i];
              if (r.isFinal) finalRef.current += r[0].transcript + " ";
              else interimText += r[0].transcript;
            }
            setTranscript(finalRef.current.trim());
            setInterim(interimText);
          };
          rec.onerror = () => {};
          rec.onend = () => setInterim("");
          rec.start();
          recognitionRef.current = rec;
        }
      }

      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      setRecording(true);
    } catch {
      setError(
        "Couldn't access the microphone. Check browser permissions, or upload an audio file instead.",
      );
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recognitionRef.current?.stop();
    timerRef.current && clearInterval(timerRef.current);
    setInterim("");
    setRecording(false);
    // If no client is picked yet, try to work out who this meeting was with
    // from what was said (small delay so the last speech results land).
    if (!clientId) {
      setTimeout(() => matchClientFromText(finalRef.current, true), 500);
    }
    if (!speechSupported) {
      setNotice(
        "Recorded. Live transcription isn't supported in this browser — type notes below, or set an OpenAI key to transcribe the audio.",
      );
    }
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    blobRef.current = file;
    mimeRef.current = file.type || "audio/mpeg";
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(file));
    setNotice("Audio attached. Use “Transcribe audio” or type the notes below.");
  }

  async function transcribeUploaded() {
    if (!blobRef.current) return;
    setTranscribing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", blobRef.current, `recording.${mimeRef.current.includes("mp4") ? "m4a" : "webm"}`);
      const res = await fetch("/api/meetings/transcribe", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.transcript) {
        setTranscript((t) => (t ? t + "\n" : "") + data.transcript);
      } else {
        setNotice(
          data.error ||
            "Server transcription isn't configured. Add an OpenAI key, or type the notes manually.",
        );
      }
    } catch {
      setError("Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }

  async function generateSummary() {
    const text = [transcript, summary].filter(Boolean).join("\n");
    if (!text.trim()) {
      setNotice("Add a transcript or some notes first, then generate a summary.");
      return;
    }
    setSummarising(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.summary) setSummary(data.summary);
        if (Array.isArray(data.actionItems))
          setActionText(data.actionItems.join("\n"));
        if (!data.aiGenerated)
          setNotice("Drafted without AI (no Anthropic key set). Edit as needed.");
      } else {
        setError(data.error || "Couldn't generate a summary.");
      }
    } catch {
      setError("Couldn't generate a summary.");
    } finally {
      setSummarising(false);
    }
  }

  async function save() {
    if (!clientId) {
      setError("Please choose a client.");
      return;
    }
    if (needsSetup && !rhythmChoice) {
      setError("Quick one-time question: how often do you normally visit this client?");
      return;
    }
    if (needsSetup && rhythmChoice === "custom" && !(parseInt(customDays, 10) > 0)) {
      setError("Enter how many days you normally leave between visits.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // One-time client setup — store the answers before logging the meeting.
      if (needsSetup) {
        const expectedIntervalDays =
          rhythmChoice === "learn"
            ? null
            : rhythmChoice === "custom"
              ? parseInt(customDays, 10)
              : parseInt(rhythmChoice, 10);
        const parsedValue = parseFloat(valueInput.replace(/[£,\s]/g, ""));
        const setupPayload: Record<string, unknown> = {
          setupCompleted: true,
          expectedIntervalDays,
        };
        // Don't overwrite a Power BI-synced value unless the rep typed one.
        if (valueInput.trim() && Number.isFinite(parsedValue) && parsedValue >= 0) {
          if (selectedClient?.annualValue !== parsedValue)
            setupPayload.annualValue = parsedValue;
        }
        const setupRes = await fetch(`/api/clients/${clientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(setupPayload),
        });
        if (!setupRes.ok) {
          const d = await setupRes.json().catch(() => ({}));
          throw new Error(d.error || "Couldn't save the client setup answers.");
        }
      }

      let audioFileUrl: string | null = null;
      let audioMimeType: string | null = null;

      if (blobRef.current) {
        const form = new FormData();
        const ext = mimeRef.current.includes("mp4") ? "m4a" : "webm";
        form.append("audio", blobRef.current, `recording.${ext}`);
        const up = await fetch("/api/meetings/upload", {
          method: "POST",
          body: form,
        });
        if (up.ok) {
          const d = await up.json();
          audioFileUrl = d.audioFileUrl;
          audioMimeType = d.audioMimeType;
        }
      }

      const actionItems = actionText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const meetingPayload = {
        meetingDate: new Date(`${meetingDate}T12:00:00`).toISOString(),
        meetingType,
        status: "completed",
        transcript: transcript || null,
        aiSummary: summary || null,
        actionItems,
        followUpRequired: actionItems.length > 0,
        audioFileUrl,
        audioMimeType,
      };

      // Logging a booked visit? Complete THAT meeting. Otherwise create one.
      const res = meetingId
        ? await fetch(`/api/meetings/${meetingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(meetingPayload),
          })
        : await fetch("/api/meetings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, ...meetingPayload }),
          });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Save failed");
      }
      router.push(`/clients/${clientId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Consent reminder */}
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Make sure everyone in the meeting is happy to be recorded before you start.
        </span>
      </div>

      {/* Meeting details */}
      <div className="card card-pad">
        <StepTitle
          n={1}
          title="Who did you meet, and when?"
          hint="Not sure of the name in the list? Record first — we'll find the client from what you say."
        />
        <div className="grid gap-4 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <label className="label">Client (from Power BI)</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Type to search all customers…"
              value={clientQuery}
              onChange={(e) => {
                setClientQuery(e.target.value);
                setClientId("");
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            {(linking || matching) && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
            )}
          </div>

          {searchOpen && searchResults && (searchResults.matches.length > 0 || searchResults.powerbi.length > 0) && (
            <div className="absolute z-20 mt-1 max-h-72 w-full min-w-[280px] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
              {searchResults.matches.length > 0 && (
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Your clients
                </p>
              )}
              {searchResults.matches.map((m) => (
                <button
                  key={m.clientId}
                  type="button"
                  onClick={() => selectClient(m.clientId)}
                  className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-brand-50"
                >
                  {m.clientName}
                </button>
              ))}
              {searchResults.powerbi.length > 0 && (
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  From Power BI
                </p>
              )}
              {searchResults.powerbi.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  disabled={linking}
                  onClick={() => pickPowerBi(p.name)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50 disabled:opacity-50"
                >
                  <span className="text-gray-800">{p.name}</span>
                  <span className="ml-1 text-xs text-gray-400">
                    {[p.rep, fmtValueShort(p.value)].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          )}
          {searchOpen && searchResults && searchResults.matches.length === 0 && searchResults.powerbi.length === 0 && clientQuery.trim().length >= 2 && (
            <p className="mt-1 text-xs text-amber-700">
              No customer found — check the spelling. Clients must match a real Power BI customer.
            </p>
          )}

          <button
            type="button"
            onClick={() => matchClientFromText(transcript)}
            disabled={matching || !transcript.trim()}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50"
          >
            {matching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Find the client from my notes
          </button>
          {(matchSuggestions.length > 0 || pbiSuggestions.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="w-full text-xs text-gray-500">Did you mean:</span>
              {matchSuggestions.map((m) => (
                <button
                  key={m.clientId}
                  type="button"
                  onClick={() => selectClient(m.clientId)}
                  className="badge bg-brand-50 text-brand-700 hover:bg-brand-100"
                >
                  {m.clientName} ({Math.round(m.score * 100)}%)
                </button>
              ))}
              {pbiSuggestions.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  disabled={linking}
                  onClick={() => pickPowerBi(p.name)}
                  className="badge bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  title={[p.rep, fmtValueShort(p.value)].filter(Boolean).join(" · ")}
                >
                  {p.name} · Power BI
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={meetingType}
            onChange={(e) => setMeetingType(e.target.value)}
          >
            {MEETING_TYPES.map((t) => (
              <option key={t} value={t}>
                {LABELS.meetingType[t]}
              </option>
            ))}
          </select>
        </div>
        </div>
      </div>

      {/* One-time client setup — asked the first time a meeting is logged. */}
      {needsSetup && (
        <div className="card card-pad space-y-4 border-brand-200 bg-brand-50/40">
          <div className="flex items-start gap-2">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <div>
              <h3 className="font-semibold text-gray-900">
                Quick setup for {selectedClient?.clientName}
              </h3>
              <p className="text-sm text-gray-600">
                One-time questions so reminders fit this client from day one —
                instead of a one-size-fits-all schedule.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">How often do you normally visit them? *</label>
              <select
                className="input"
                value={rhythmChoice}
                onChange={(e) => setRhythmChoice(e.target.value)}
              >
                <option value="">Choose…</option>
                {RHYTHM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {rhythmChoice === "custom" && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  Every
                  <input
                    type="number"
                    min={1}
                    className="input w-24"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                  />
                  days
                </div>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Your answer is the starting point — the schedule keeps adjusting
                to how you actually visit.
              </p>
            </div>
            <div>
              <label className="label">Roughly what are they worth per year (£)?</label>
              <input
                type="number"
                min={0}
                className="input"
                placeholder="e.g. 12000"
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">
                {selectedClient?.valueSource === "powerbi"
                  ? "Filled in from Power BI — override it if you know better."
                  : "Optional. Filled automatically if you sync Power BI. Higher-value clients get higher visit priority."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recording panel */}
      <div className="card card-pad">
        <StepTitle
          n={2}
          title="Record the conversation"
          hint="Optional — you can skip this and just type your notes in step 3."
        />
        <div className="flex flex-col items-center gap-3 py-2">
          {!recording ? (
            <button
              onClick={startRecording}
              disabled={!recordSupported}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
              aria-label="Start recording"
            >
              <Mic className="h-8 w-8" />
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-status-overdue text-white shadow-lg"
              aria-label="Stop recording"
            >
              <Square className="h-7 w-7" fill="currentColor" />
            </button>
          )}
          <div className="text-sm text-gray-500">
            {recording ? (
              <span className="font-medium text-status-overdue">
                ● Recording {fmtTime(elapsed)}
              </span>
            ) : audioUrl ? (
              "Recorded — review below or record again"
            ) : recordSupported ? (
              "Tap to start recording"
            ) : (
              "Recording not supported here — upload a file below"
            )}
          </div>

          <label className="btn-secondary cursor-pointer text-xs">
            <Upload className="h-4 w-4" /> Upload audio instead
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={onUpload}
            />
          </label>
        </div>

        {audioUrl && (
          <audio controls src={audioUrl} className="mt-3 w-full" />
        )}
        {blobRef.current && (
          <button
            onClick={transcribeUploaded}
            disabled={transcribing}
            className="btn-secondary mt-3 text-xs"
          >
            {transcribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Transcribe audio
          </button>
        )}
      </div>

      {/* Transcript */}
      <div className="card card-pad">
        <StepTitle
          n={3}
          title="Notes & transcript"
          hint="What was said appears here while you record — or just type what you remember."
        />
        <textarea
          className="input min-h-[140px]"
          placeholder="Live transcription appears here while recording. You can also just type your notes."
          value={transcript}
          onChange={(e) => {
            setTranscript(e.target.value);
            finalRef.current = e.target.value + " ";
          }}
        />
        {interim && (
          <p className="mt-1 text-sm italic text-gray-400">
            …{interim}
          </p>
        )}
        <button
          onClick={generateSummary}
          disabled={summarising}
          className="btn-primary mt-3"
        >
          {summarising ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate summary & action points
        </button>
      </div>

      {/* Summary + actions */}
      <div className="card card-pad">
        <StepTitle
          n={4}
          title="Summary & follow-ups"
          hint="Use the button above to fill these in automatically, then tidy them up."
        />
        <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Summary</label>
          <textarea
            className="input min-h-[120px]"
            placeholder="A short summary of the meeting."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Action points (one per line)</label>
          <textarea
            className="input min-h-[120px]"
            placeholder={"Send seasonal samples\nPrepare updated price list"}
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
          />
        </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-status-overdue">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {notice}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={save} disabled={saving} className="btn-primary px-6">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save meeting
        </button>
      </div>
    </div>
  );
}
