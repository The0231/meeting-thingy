import { getClients } from "@/lib/clients";
import { PageHeader } from "@/components/PageHeader";
import { RecordMeetingForm } from "@/components/RecordMeetingForm";

export default async function RecordMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Record a meeting"
        subtitle="Record or upload audio, get a transcript and summary, and we'll update this client's rhythm automatically."
      />
      <RecordMeetingForm clients={options} preselectedClientId={sp.clientId} />
    </div>
  );
}
