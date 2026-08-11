-- Email OTP gate before password reset. Everyone's password was just mass-
-- reset to a shared default (launch-day emergency), so before anyone can
-- set their own new password, they have to prove they control their KJIT
-- inbox — otherwise anyone who knows a roll number could hijack any
-- account via the shared default password.
--
-- Run this in Supabase Dashboard -> SQL Editor.

create table if not exists login_otps (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null,   -- 'student' | 'organizer'
  recipient_id uuid not null,
  code_hash text not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists login_otps_recipient_idx on login_otps(recipient_type, recipient_id);

alter table login_otps enable row level security;
-- No public policies — server-side only, service role key.
