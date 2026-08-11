-- WhatsApp setup isn't viable right now, so notifications move to email
-- instead. Students, faction heads, and most organizers already carry a
-- KJIT roll number, so their email (rollnumber@kristujayanti.com) is
-- derived in application code -- no column, no data collection needed.
-- Faculty are the one role with no roll number and no fixed address
-- pattern, so they self-report theirs at first login.
--
-- Run this in Supabase Dashboard -> SQL Editor.

alter table organizers add column if not exists email text;
