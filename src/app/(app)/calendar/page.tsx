import Link from "next/link";
import { Mic } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Calendar } from "@/components/Calendar";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle="Past meetings, scheduled visits and suggested follow-ups"
        action={
          <Link href="/record" className="btn-primary">
            <Mic className="h-4 w-4" />
            Record meeting
          </Link>
        }
      />
      <Calendar />
    </div>
  );
}
