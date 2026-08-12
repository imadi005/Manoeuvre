-- Round-by-round progression within an event, entered by the event lead
-- after each round. Two shapes share one table: team-based events record
-- against event_teams (member roll numbers are derived by joining
-- event_registrations on team_id); flat individual events (The Blacktie
-- Protocol) record directly against students. Exactly one of team_id /
-- student_id is set per row, enforced by the check constraint below.
--
-- This is separate from event_results (which carries the faculty/control-room
-- approved FINAL faction placement that drives leaderboard points) — round
-- progress is informational advancement tracking, entered directly by the
-- event lead with no approval gate.

create table if not exists event_round_results (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  round_number int not null,
  team_id uuid references event_teams(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  status text not null check (status in ('advanced', 'eliminated', 'winner', 'runner_up')),
  entered_by uuid references organizers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((team_id is not null) <> (student_id is not null))
);

-- Partial unique indexes (not a single UNIQUE constraint) because Postgres
-- treats every NULL as distinct in a regular unique constraint — a plain
-- unique(event_slug, round_number, team_id) would let the same team get
-- multiple rows for one round whenever student_id rows are interleaved.
create unique index if not exists event_round_results_team_unique
  on event_round_results(event_slug, round_number, team_id) where team_id is not null;
create unique index if not exists event_round_results_student_unique
  on event_round_results(event_slug, round_number, student_id) where student_id is not null;

create index if not exists event_round_results_event_round_idx on event_round_results(event_slug, round_number);

alter table event_round_results enable row level security;
-- No public policies — server-side code only, via the service role key.
