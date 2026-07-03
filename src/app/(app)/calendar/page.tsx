import { PageHeader } from "@/components/PageHeader";
import { Calendar } from "@/components/Calendar";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle="Scheduled visits show on the calendar. Suggested visits for the next few weeks appear below — each with a recommended date — most urgent first."
      />
      <Calendar />
    </div>
  );
}
