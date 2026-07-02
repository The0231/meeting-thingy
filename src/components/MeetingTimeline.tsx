import { CalendarDays, ListChecks } from "lucide-react";
import { fmtDay } from "@/lib/format";
import { LABELS, type MeetingDTO } from "@/lib/types";
import { MeetingTypeIcon } from "./MeetingTypeIcon";
import { DeleteButton } from "./DeleteButton";

export function MeetingTimeline({
  meetings,
  emptyHint = "No meetings logged yet.",
}: {
  meetings: MeetingDTO[];
  emptyHint?: string;
}) {
  if (meetings.length === 0) {
    return (
      <div className="card card-pad text-center text-sm text-gray-500">
        {emptyHint}
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-gray-200 pl-6">
      {meetings.map((m) => (
        <li key={m.id} className="relative">
          <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500">
            <MeetingTypeIcon type={m.meetingType} className="h-3.5 w-3.5" />
          </span>
          <div className="card card-pad">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <CalendarDays className="h-4 w-4 text-gray-400" />
                {fmtDay(m.meetingDate)}
                <span className="text-gray-300">·</span>
                <span className="text-gray-500">{LABELS.meetingType[m.meetingType]}</span>
                {m.status === "scheduled" && (
                  <span className="badge bg-blue-50 text-blue-700">Scheduled</span>
                )}
                {m.followUpRequired && (
                  <span className="badge bg-amber-50 text-amber-700">Follow-up</span>
                )}
              </div>
              <DeleteButton
                url={`/api/meetings/${m.id}`}
                label="Delete"
                iconOnly
                confirmText="Delete this meeting? This affects the learned interval."
                className="btn-ghost px-2 py-1 text-gray-400 hover:bg-red-50 hover:text-status-overdue"
              />
            </div>

            {m.aiSummary && (
              <p className="mt-2 text-sm text-gray-700">{m.aiSummary}</p>
            )}
            {m.manualNotes && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{m.manualNotes}</p>
            )}

            {m.actionItems.length > 0 && (
              <div className="mt-3 rounded-lg bg-gray-50 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <ListChecks className="h-3.5 w-3.5" /> Action points
                </div>
                <ul className="list-inside list-disc space-y-0.5 text-sm text-gray-700">
                  {m.actionItems.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {m.hasAudio && (
              <audio
                controls
                preload="none"
                src={`/api/audio/${m.id}`}
                className="mt-3 w-full"
              />
            )}

            {m.transcript && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-brand-700 hover:underline">
                  View transcript
                </summary>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-gray-600">
                  {m.transcript}
                </p>
              </details>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
