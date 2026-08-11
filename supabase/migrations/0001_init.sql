-- MANOEUVRE 2026 — initial schema: factions, students, faction heads
-- Run this in Supabase Dashboard -> SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists factions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  glow text not null,
  lore text not null,
  created_at timestamptz not null default now()
);

create table if not exists faction_heads (
  id uuid primary key default gen_random_uuid(),
  faction_id uuid not null references factions(id) on delete cascade,
  name text not null,
  username text unique not null, -- e.g. "neo-ronin.agnel"
  password_hash text not null,
  must_reset_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  roll_number text unique not null,
  name text not null,
  faction_id uuid references factions(id) on delete set null,
  password_hash text not null,
  must_reset_password boolean not null default true,
  created_at timestamptz not null default now()
);

-- Row Level Security: locked down by default.
-- All reads/writes go through server-side code using the service role key,
-- never directly from the browser with the publishable key.
alter table factions enable row level security;
alter table faction_heads enable row level security;
alter table students enable row level security;

create policy "factions are publicly readable"
  on factions for select
  using (true);

-- No policies on faction_heads / students for the publishable (anon) key —
-- intentionally unreadable/unwritable from the browser. Server routes use
-- the service role key, which bypasses RLS.
