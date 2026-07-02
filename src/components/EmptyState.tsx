import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon && <div className="text-gray-300">{icon}</div>}
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        {hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
