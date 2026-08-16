-- Gaming (The Grid) substitute registrations. A substitute occupies a normal
-- team slot but is exempt from the schedule-conflict check in both
-- directions: adding them to gaming skips the clash check, and their gaming
-- slug is excluded when checking OTHER events for a clash.

alter table event_registrations add column if not exists is_substitute boolean not null default false;
