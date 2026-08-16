-- Replaces the manual "submit final result" form with a guided event-lead
-- workflow: attendance -> round-by-round advance/eliminate -> final
-- placements -> auto-submitted to the existing faculty-approval pipeline.
-- Run this in Supabase Dashboard -> SQL Editor.

-- One row per event: what stage it's in. current_round = 0 means
-- attendance/not started; 1..rounds means that round is active. rounds
-- itself comes from lib/data.ts, not stored here.
create table if not exists event_progress (
  event_slug text primary key,
  current_round int not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table event_progress enable row level security;
-- No public policies -- server-side code only, via the service role key.

-- Attendance: one row per team (or per individual for flat events) that
-- showed up. Absence = no row, no separate "marked absent" state needed.
-- Participation points (immediate, not gated behind faculty approval) are
-- computed live from this table by lib/scoring.ts.
create table if not exists event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  team_id uuid references event_teams(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  faction_id uuid not null references factions(id) on delete cascade,
  marked_by uuid references organizers(id) on delete set null,
  marked_at timestamptz not null default now(),
  check ((team_id is not null) <> (student_id is not null))
);

create unique index if not exists event_attendance_team_unique
  on event_attendance(event_slug, team_id) where team_id is not null;
create unique index if not exists event_attendance_student_unique
  on event_attendance(event_slug, student_id) where student_id is not null;
create index if not exists event_attendance_event_idx on event_attendance(event_slug);

alter table event_attendance enable row level security;
-- No public policies -- server-side code only, via the service role key.

-- Add the 3rd-place tier to the existing round-results status set.
alter table event_round_results drop constraint if exists event_round_results_status_check;
alter table event_round_results add constraint event_round_results_status_check
  check (status in ('advanced', 'eliminated', 'winner', 'runner_up', 'third'));
