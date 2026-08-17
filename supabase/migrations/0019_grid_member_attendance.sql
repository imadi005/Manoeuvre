-- Individual per-member attendance within a Grid team (BGMI/PES squads) --
-- purely informational, separate from the team-level event_attendance row
-- that actually drives Participation points. Lets the event lead see
-- exactly who on a squad has shown up (useful for substitute swap calls)
-- without affecting scoring. Run this in Supabase Dashboard -> SQL Editor.

create table if not exists event_member_attendance (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  team_id uuid not null references event_teams(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  marked_by uuid references organizers(id) on delete set null,
  marked_at timestamptz not null default now(),
  unique (team_id, student_id)
);

create index if not exists event_member_attendance_event_idx on event_member_attendance(event_slug);

alter table event_member_attendance enable row level security;
-- No public policies -- server-side code only, via the service role key.
