import { MapPin, Phone, Users, Video } from "lucide-react";
import type { MeetingType } from "@/lib/types";

const ICONS = {
  in_person: Users,
  phone: Phone,
  video: Video,
  site_visit: MapPin,
} as const;

export function MeetingTypeIcon({
  type,
  className = "h-4 w-4",
}: {
  type: MeetingType;
  className?: string;
}) {
  const Icon = ICONS[type] ?? Users;
  return <Icon className={className} />;
}
