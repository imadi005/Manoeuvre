-- Extends the result pipeline from a 2-step (event lead -> control room) flow
-- into the real 4-step approval chain: event lead submits -> faculty in
-- charge approves -> control room cross-checks -> control room publishes
-- (leaderboard updates + event closes + documentation gets notified).
--
-- Run this in Supabase Dashboard -> SQL Editor.

-- status now moves through:
--   submitted -> faculty_approved -> control_verified -> published
-- with faculty_rejected / control_rejected as send-back states at each gate.
alter table event_results
  alter column status set default 'submitted';

update event_results set status = 'submitted' where status = 'pending';
update event_results set status = 'published' where status = 'verified';
-- 'rejected' rows predate the faculty gate — they were rejected by control
-- room directly, so map them to the new control-room rejection state.
update event_results set status = 'control_rejected' where status = 'rejected';

alter table event_results add column if not exists faculty_approved_by uuid references organizers(id);
alter table event_results add column if not exists faculty_approved_at timestamptz;
alter table event_results add column if not exists control_verified_by uuid references organizers(id);
alter table event_results add column if not exists control_verified_at timestamptz;
alter table event_results add column if not exists published_by uuid references organizers(id);
alter table event_results add column if not exists published_at timestamptz;
alter table event_results add column if not exists rejection_reason text;

-- verified_by / verified_at from the old 2-step flow are superseded by the
-- per-stage columns above but kept in place (no data loss) — the
-- application code no longer writes to them.

-- 'faculty' joins the existing free-text organizers.role values
-- ('main_coordinator' | 'event_lead' | 'control_room' | 'documentation' |
-- 'committee'). No schema change needed since role is already text; this
-- comment documents the new allowed value.

-- Documentation write-ups, saved by the documentation team once an event
-- publishes — separate from the auto-generated stats already shown.
create table if not exists event_reports (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null unique,
  summary text,
  highlights text,
  issues text,
  written_by uuid references organizers(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table event_reports enable row level security;
-- No public policies — server-side only, service role key.

-- Notification log — every attempted notification is recorded here
-- regardless of whether the send channel is configured, so nothing is
-- silently lost while WhatsApp credentials are being set up.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null, -- 'student' | 'organizer'
  recipient_id uuid not null,
  channel text not null,        -- 'whatsapp' | 'email' | 'inapp'
  type text not null,           -- e.g. 'registration_confirmed', 'faculty_approval_needed'
  message text not null,
  status text not null default 'pending', -- 'pending' | 'sent' | 'failed' | 'skipped_no_config'
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notifications_recipient_idx on notifications(recipient_type, recipient_id);
create index if not exists notifications_status_idx on notifications(status);

alter table notifications enable row level security;
-- No public policies — server-side only, service role key.

-- Phone numbers aren't in the original roster import, so there's nowhere
-- to send WhatsApp messages yet. Students/organizers self-report theirs
-- during the (mandatory, one-time) password reset flow.
alter table students add column if not exists phone text;
alter table organizers add column if not exists phone text;
