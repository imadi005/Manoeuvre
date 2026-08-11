-- Event results: event leads submit placements, control room verifies them.
-- Points are computed in application code from lib/data.ts pointsTier + a
-- fixed 40/30/20/10 split across 1st-4th place — never stored redundantly.

create table if not exists event_results (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null unique,
  first_faction_id uuid references factions(id),
  second_faction_id uuid references factions(id),
  third_faction_id uuid references factions(id),
  fourth_faction_id uuid references factions(id),
  status text not null default 'pending', -- 'pending' | 'verified' | 'rejected'
  submitted_by uuid references organizers(id),
  verified_by uuid references organizers(id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_results_status_idx on event_results(status);

alter table event_results enable row level security;
-- No public policies — server-side code only, via the service role key.
-- The public leaderboard page reads through the service role client too,
-- same pattern as factions/roster pages.
