"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Mic, CalendarHeart } from "lucide-react";

// The meetings side is deliberately just the calendar — everything happens
// from there (day panels, suggested visits, the log-a-meeting button).
// Dashboard/clients/Power BI pages still exist and are linked contextually.
const NAV = [{ href: "/calendar", label: "Calendar", icon: CalendarDays }];

function isActive(pathname: string, href: string): boolean {
  if (href === "/calendar") return pathname === "/" || pathname.startsWith("/calendar");
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname() ?? "";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-100 bg-white/70 backdrop-blur-md md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-gray-900">Client Calendar</div>
            <div className="text-xs text-gray-400">Smart follow-ups</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Meetings
          </div>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-gradient-to-r from-brand-50 to-brand-100/60 text-brand-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100/80 hover:pl-5"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <Link href="/record" className="btn-primary w-full">
            <Mic className="h-4 w-4" /> Record meeting
          </Link>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-200 bg-white md:hidden">
        {[
          ...NAV,
          { href: "/record", label: "Log meeting", icon: Mic },
        ].map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                active ? "text-brand-700" : "text-gray-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
