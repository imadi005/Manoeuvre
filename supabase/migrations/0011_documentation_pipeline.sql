-- Post-event documentation pipeline: control room publish -> media team
-- notified to upload photos -> once uploaded, documentation team notified
-- -> they fill in the full KJIT report format (most fields auto-derived
-- already; write-up/objectives/outcome/feedback/web-url are typed) ->
-- submit for approval -> faculty in charge approves -> visible on the
-- coordinator dashboard. Mirrors the existing results-approval pattern.

-- Storage bucket for event photos (geotagged + normal). Public read so the
-- documentation form and any future public gallery can just link straight
-- to the file; all writes go through server actions with the service role
-- key regardless, so public read doesn't weaken write security.
insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;

create table if not exists event_photos (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  storage_path text not null,
  photo_type text not null check (photo_type in ('geotagged', 'normal')),
  uploaded_by uuid references organizers(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists event_photos_event_idx on event_photos(event_slug);

alter table event_photos enable row level security;
-- No public policies — server-side only, service role key.

-- 'media' joins the existing free-text organizers.role values, same as
-- 'faculty' did in migration 0006 — no schema change needed since role is
-- already text; this comment documents the new allowed value.

-- Extend event_reports with the rest of the KJIT report format (title,
-- date, time, venue, beneficiaries, and participants are all derivable at
-- read time from lib/schedule.ts / event_registrations, so they don't need
-- their own columns here) plus the approval state machine.
alter table event_reports add column if not exists objectives text;
alter table event_reports add column if not exists outcome text;
alter table event_reports add column if not exists feedback text;
alter table event_reports add column if not exists web_url text;
alter table event_reports add column if not exists status text not null default 'draft';
alter table event_reports add column if not exists submitted_by uuid references organizers(id);
alter table event_reports add column if not exists submitted_at timestamptz;
alter table event_reports add column if not exists approved_by uuid references organizers(id);
alter table event_reports add column if not exists approved_at timestamptz;
alter table event_reports add column if not exists rejection_reason text;
-- status: 'draft' (documentation still editing) | 'submitted' (awaiting
-- faculty approval) | 'approved' | 'rejected' (sent back, documentation
-- can resubmit). Not a DB check constraint — kept as free text so the
-- Next.js layer owns validation, consistent with organizers.role.
