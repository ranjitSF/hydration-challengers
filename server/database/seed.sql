-- Seed: Round of 16 field, bracket skeleton, and config
-- Safe to re-run: uses ON CONFLICT DO NOTHING / DO UPDATE

INSERT INTO matches (round, slot, team_a, team_b, kickoff_at, venue) VALUES
  ('R16', 'M89', 'Paraguay', 'France', '2026-07-04T17:00:00-04:00', 'Philadelphia'),
  ('R16', 'M90', 'Canada', 'Morocco', '2026-07-04T13:00:00-04:00', 'Houston'),
  ('R16', 'M91', 'Brazil', 'Norway', '2026-07-05T16:00:00-04:00', 'New Jersey'),
  ('R16', 'M92', 'Mexico', 'England', '2026-07-05T20:00:00-04:00', 'Mexico City'),
  ('R16', 'M93', 'Spain', 'Portugal', '2026-07-06T15:00:00-04:00', 'Arlington'),
  ('R16', 'M94', 'USA', 'Belgium', '2026-07-06T20:00:00-04:00', 'Seattle'),
  ('R16', 'M95', 'TBD', 'Egypt', '2026-07-07T12:00:00-04:00', 'Atlanta'),
  ('R16', 'M96', 'Switzerland', 'TBD', '2026-07-07T16:00:00-04:00', 'Vancouver'),
  -- QF pairing verified against FIFA's official bracket (M97-M100):
  -- QF1 = W(M89) v W(M90), QF2 = W(M93) v W(M94), QF3 = W(M91) v W(M92), QF4 = W(M95) v W(M96)
  ('QF', 'QF1', NULL, NULL, '2026-07-09T15:00:00-04:00', 'Boston'),
  ('QF', 'QF2', NULL, NULL, '2026-07-10T15:00:00-04:00', 'Los Angeles'),
  ('QF', 'QF3', NULL, NULL, '2026-07-11T15:00:00-04:00', 'Miami'),
  ('QF', 'QF4', NULL, NULL, '2026-07-11T15:00:00-04:00', 'Kansas City'),
  -- SF1 = W(QF1) v W(QF2), SF2 = W(QF3) v W(QF4)
  ('SF', 'SF1', NULL, NULL, '2026-07-14T15:00:00-04:00', 'Dallas'),
  ('SF', 'SF2', NULL, NULL, '2026-07-15T15:00:00-04:00', 'Atlanta'),
  ('F', 'F1', NULL, NULL, '2026-07-19T15:00:00-04:00', 'East Rutherford')
ON CONFLICT (slot) DO NOTHING;

INSERT INTO config (key, value) VALUES
  ('lock_at', '2026-07-04T09:45:00-07:00'),
  ('bracket_pairing', '{"QF1":["M89","M90"],"QF2":["M93","M94"],"QF3":["M91","M92"],"QF4":["M95","M96"],"SF1":["QF1","QF2"],"SF2":["QF3","QF4"],"F1":["SF1","SF2"]}'),
  ('team_name_map', '{}')
ON CONFLICT (key) DO NOTHING;

-- Placeholder roster - replace with the real ~12-person list before launch
INSERT INTO players (email, display_name) VALUES
  ('test1@example.com', 'Test Player One'),
  ('test2@example.com', 'Test Player Two'),
  ('test3@example.com', 'Test Player Three')
ON CONFLICT (email) DO NOTHING;
