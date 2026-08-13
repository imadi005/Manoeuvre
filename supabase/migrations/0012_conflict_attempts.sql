-- Logs every time addRegistration blocks a student for a schedule conflict.
-- Previously this just returned an error to the UI with nothing persisted,
-- so there was no way to see how often it actually fires. Read-only from
-- here on — this table is written once per blocked attempt, never updated.

create table if not exists conflict_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  faction_id uuid not null references factions(id) on delete cascade,
  attempted_event_slug text not null,
  conflicting_event_slug text not null,
  attempted_by uuid references faction_heads(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists conflict_attempts_created_idx on conflict_attempts(created_at desc);

alter table conflict_attempts enable row level security;
-- No public policies — server-side code only, via the service role key.
