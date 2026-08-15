-- Tracks which events have already had their 24h-before-first-round
-- registration lock fire (and the lock-notification emails sent). One row
-- per event, written once by the lock-events cron route. Run this in
-- Supabase Dashboard -> SQL Editor.

create table if not exists event_locks (
  event_slug text primary key,
  locked_at timestamptz not null default now(),
  notified_at timestamptz
);

alter table event_locks enable row level security;
-- No public policies -- server-side code only, via the service role key.
