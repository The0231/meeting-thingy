import Link from "next/link";
import type { Tone } from "@/lib/ui";
import { TONE_CLASSES } from "@/lib/ui";

export function StatCard({
  label,
  value,
  tone = "paused",
  href,
  hint,
}: {
  label: string;
  value: number | string;
  tone?: Tone;
  href?: string;
  hint?: string;
}) {
  const c = TONE_CLASSES[tone];
  const body = (
    <div className="card h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-cardhover">
      <div className={`${c.softBg} h-full p-5`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">{label}</span>
          <span className={`h-2.5 w-2.5 rounded-full ${c.dot} shadow-sm`} />
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{value}</div>
        {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
