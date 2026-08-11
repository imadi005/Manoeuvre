insert into factions (slug, name, glow, lore) values
  ('neo-ronin', 'Neo Ronin', 'magenta', 'No master, no crew, no excuses — just discipline sharpened alone and pointed at the board.'),
  ('aetheris', 'Aetheris', 'cyan', 'The faction that sees the pattern before anyone else finishes reading the question.'),
  ('hyperion', 'Hyperion', 'yellow', 'Named for the titan that outlasted the rest. Hyperion doesn''t rush the board — it wears it down.'),
  ('phoenix', 'Phoenix', 'magenta', 'Every edition it loses, it comes back louder. Phoenix doesn''t fear an early setback.'),
  ('maelstrom', 'Maelstrom', 'cyan', 'Controlled chaos. Maelstrom thrives exactly where the schedule gets messy.'),
  ('renegades', 'Renegades', 'yellow', 'Doesn''t play the meta — builds its own and dares the rest of the grid to catch up.'),
  ('nightwire', 'Nightwire', 'magenta', 'Quiet until the leaderboard updates. Nightwire moves in the dark and shows up on top.'),
  ('edgerunners', 'Edgerunners', 'cyan', 'First into every event, last to back down. Edgerunners run the risk everyone else avoids.')
on conflict (slug) do nothing;
