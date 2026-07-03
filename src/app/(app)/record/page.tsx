import { getClients } from "@/lib/clients";
import { getMeeting } from "@/lib/meetings";
import { PageHeader } from "@/components/PageHeader";
import { RecordMeetingForm } from "@/components/RecordMeetingForm";

export default async function RecordMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; meetingId?: string }>;
}) {
  const sp = await searchParams;
  const clients = await getClients();
  const options = clients
    .map((c) => ({
      id: c.id,
      clientName: c.clientName,
      setupCompleted: c.setupCompleted,
      expectedIntervalDays: c.expectedIntervalDays,
      annualValue: c.annualValue,
      valueSource: c.valueSource,
      meetingCount: c.meetingCount,
    }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName));

  // Logging a booked visit? Preselect its client and default to the booked date.
  const booking = sp.meetingId ? await getMeeting(sp.meetingId) : null;
  const preselectedClientId = booking?.clientId ?? sp.clientId;
  const defaultDate = booking?.meetingDate?.slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={booking ? "Log this visit" : "Record a meeting"}
        subtitle={
          booking
            ? "Record what happened on your booked visit — it updates this client's rhythm automatically."
            : "Record or upload audio, get a transcript and summary, and we'll update this client's rhythm automatically."
        }
      />
      <RecordMeetingForm
        clients={options}
        preselectedClientId={preselectedClientId}
        meetingId={booking ? sp.meetingId : undefined}
        defaultDate={defaultDate}
      />
    </div>
  );
}
