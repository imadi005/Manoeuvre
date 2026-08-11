-- Faction heads enter their students into events here. Event identity is
-- just the static slug from lib/data.ts (events aren't modeled in the DB).

create table if not exists event_registrations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  faction_id uuid not null references factions(id) on delete cascade,
  event_slug text not null,
  registered_by uuid references faction_heads(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, event_slug)
);

create index if not exists event_registrations_faction_event_idx on event_registrations(faction_id, event_slug);
create index if not exists event_registrations_student_idx on event_registrations(student_id);

alter table event_registrations enable row level security;
-- No public policies — server-side code only, via the service role key.
