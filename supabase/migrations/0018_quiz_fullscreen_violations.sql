-- Logs every time a student's browser exits fullscreen while the Blacktie
-- Protocol quiz is active (not yet submitted) -- surfaced live to the event
-- lead. Run this in Supabase Dashboard -> SQL Editor.

create table if not exists quiz_fullscreen_violations (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  student_id uuid not null references students(id) on delete cascade,
  occurred_at timestamptz not null default now()
);

create index if not exists quiz_fullscreen_violations_event_idx on quiz_fullscreen_violations(event_slug);

alter table quiz_fullscreen_violations enable row level security;
-- No public policies -- server-side code only, via the service role key.
