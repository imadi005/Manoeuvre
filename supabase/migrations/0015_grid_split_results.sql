-- The Grid runs two independent competitions (BGMI + PES) under one event
-- slug. Each now gets its own placement + its own half of the event's point
-- pool, instead of being forced into a single overall winner. Every other
-- event keeps using sub_event = '' (unaffected).
-- Run this in Supabase Dashboard -> SQL Editor.

alter table event_results add column if not exists sub_event text not null default '';

alter table event_results drop constraint if exists event_results_event_slug_key;
alter table event_results add constraint event_results_event_slug_sub_event_key unique (event_slug, sub_event);

alter table event_attendance add column if not exists sub_event text not null default '';
