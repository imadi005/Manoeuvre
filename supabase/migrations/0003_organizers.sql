-- Roles beyond student/faction-head: main coordinators, event leads,
-- control room, documentation team, and a general committee directory
-- (the last is for certificate generation, not login).

create table if not exists organizers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  roll_number text,              -- null for faculty/staff (no student register number)
  role text not null,            -- 'main_coordinator' | 'event_lead' | 'control_room' | 'documentation' | 'committee'
  detail text,                   -- event slug for event_lead, committee name for committee/others
  is_faculty boolean not null default false,
  username text unique,          -- only set for login-capable roles
  password_hash text,
  must_reset_password boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists organizers_role_idx on organizers(role);
create index if not exists organizers_roll_number_idx on organizers(roll_number);

alter table organizers enable row level security;
-- No public policies — all access goes through server-side code using the
-- service role key, same as students/faction_heads.

alter table faction_heads add column if not exists roll_number text;
