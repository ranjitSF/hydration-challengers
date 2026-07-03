-- One More Shot: World Cup 2026 Knockout Pool schema

CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    firebase_uid VARCHAR(255) UNIQUE,
    starting_points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- round: 'R16' | 'QF' | 'SF' | 'F'
-- slot: stable identifier used by bracket pairing logic (e.g. 'M89', 'QF1', 'SF1', 'F1')
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    round VARCHAR(10) NOT NULL,
    slot VARCHAR(10) UNIQUE NOT NULL,
    team_a VARCHAR(100),
    team_b VARCHAR(100),
    kickoff_at TIMESTAMP WITH TIME ZONE,
    venue VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS picks (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    picked_team VARCHAR(100) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, match_id)
);

CREATE TABLE IF NOT EXISTS results (
    match_id INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    winner VARCHAR(100) NOT NULL,
    source VARCHAR(10) NOT NULL CHECK (source IN ('auto', 'manual')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_picks_player ON picks(player_id);
CREATE INDEX IF NOT EXISTS idx_picks_match ON picks(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(round);
