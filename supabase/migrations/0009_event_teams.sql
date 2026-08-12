-- Team-based registration within an event. Most events group a faction's
-- students into fixed-size teams (e.g. 3 teams of 2 for Cortex Vortex); a
-- few stay flat individual registration (The Blacktie Protocol) and one
-- (The Grid) splits into two independent per-game rosters (BGMI / PES) via
-- sub_event. sub_event is NOT NULL with an empty-string default rather than
-- nullable, because Postgres treats each NULL as distinct in a unique
-- constraint — a blank sentinel is required for the uniqueness check below
-- to actually hold for non-Grid events.

create table if not exists event_teams (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  faction_id uuid not null references factions(id) on delete cascade,
  sub_event text not null default '',
  team_number int not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (event_slug, faction_id, sub_event, team_number)
);

create index if not exists event_teams_faction_event_idx on event_teams(faction_id, event_slug);

alter table event_registrations add column if not exists team_id uuid references event_teams(id) on delete cascade;

alter table event_teams enable row level security;
-- No public policies — server-side code only, via the service role key.
