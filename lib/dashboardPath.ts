import type { Session } from "@/lib/auth/session";

export const DASHBOARD_BY_ROLE: Record<Session["role"], string> = {
  student: "/dashboard/student",
  faction_head: "/dashboard/faction-head",
  main_coordinator: "/dashboard/coordinator",
  event_lead: "/dashboard/event-lead",
  control_room: "/dashboard/control-room",
  documentation: "/dashboard/documentation",
  faculty: "/dashboard/faculty",
  media: "/dashboard/media",
};
