-- ============================================================
-- CLASH OF COINS — schema.sql
-- Base de données Supabase (PostgreSQL)
-- Exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- ===== JOUEURS =====
CREATE TABLE IF NOT EXISTS players (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE,
  phone         TEXT,
  avatar_url    TEXT,
  coins         BIGINT DEFAULT 1000 NOT NULL CHECK (coins >= 0),
  wins          INTEGER DEFAULT 0,
  losses        INTEGER DEFAULT 0,
  games_played  INTEGER DEFAULT 0,
  level         INTEGER DEFAULT 1,
  xp            INTEGER DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index sur username pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_players_coins ON players(coins DESC);

-- ===== TRANSACTIONS WALLET =====
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id     UUID REFERENCES players(id) ON DELETE CASCADE,
  username      TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('deposit','withdrawal','bet','win','refund','bonus')),
  amount        BIGINT NOT NULL,
  description   TEXT,
  method        TEXT,  -- orange_money, wave, mtn, moov
  reference     TEXT,  -- référence Mobile Money
  status        TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_player ON transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_tx_username ON transactions(username);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC);

-- ===== PARTIES =====
CREATE TABLE IF NOT EXISTS games (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id       TEXT UNIQUE NOT NULL,
  mode          TEXT NOT NULL CHECK (mode IN ('free','comp','tournament')),
  mise          BIGINT DEFAULT 0,
  prize         BIGINT DEFAULT 0,
  num_players   INTEGER NOT NULL CHECK (num_players BETWEEN 2 AND 4),
  winner        TEXT,
  players       TEXT[] NOT NULL,
  scores        INTEGER[] NOT NULL,
  duration_secs INTEGER,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_winner ON games(winner);

-- ===== HISTORIQUE PARTIES PAR JOUEUR =====
CREATE TABLE IF NOT EXISTS game_history (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id       UUID REFERENCES games(id) ON DELETE CASCADE,
  room_id       TEXT NOT NULL,
  username      TEXT NOT NULL,
  player_index  INTEGER NOT NULL,
  score         INTEGER DEFAULT 0,
  pieces_done   INTEGER DEFAULT 0,
  captures      INTEGER DEFAULT 0,
  won           BOOLEAN DEFAULT FALSE,
  coins_change  BIGINT DEFAULT 0,
  mise          BIGINT DEFAULT 0,
  mode          TEXT NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_username ON game_history(username);
CREATE INDEX IF NOT EXISTS idx_history_created ON game_history(created_at DESC);

-- ===== TOURNOIS =====
CREATE TABLE IF NOT EXISTS tournaments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  entry_fee     BIGINT DEFAULT 0,
  prize_pool    BIGINT DEFAULT 0,
  max_players   INTEGER DEFAULT 64,
  current_players INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed')),
  starts_at     TIMESTAMP WITH TIME ZONE,
  ends_at       TIMESTAMP WITH TIME ZONE,
  winner        TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== INSCRIPTIONS TOURNOIS =====
CREATE TABLE IF NOT EXISTS tournament_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id   UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id       UUID REFERENCES players(id) ON DELETE CASCADE,
  username        TEXT NOT NULL,
  status          TEXT DEFAULT 'registered' CHECK (status IN ('registered','eliminated','winner')),
  registered_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, player_id)
);

-- ===== AMIS =====
CREATE TABLE IF NOT EXISTS friendships (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id     UUID REFERENCES players(id) ON DELETE CASCADE,
  friend_id     UUID REFERENCES players(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, friend_id)
);

-- ===== FONCTIONS RPC =====

-- Ajouter des coins à un joueur
CREATE OR REPLACE FUNCTION add_coins(
  p_username TEXT,
  p_amount BIGINT,
  p_type TEXT DEFAULT 'deposit',
  p_description TEXT DEFAULT ''
)
RETURNS BIGINT AS $$
DECLARE
  v_new_balance BIGINT;
BEGIN
  UPDATE players
  SET coins = coins + p_amount,
      updated_at = NOW()
  WHERE username = p_username
  RETURNING coins INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Joueur introuvable: %', p_username;
  END IF;

  INSERT INTO transactions(username, type, amount, description)
  VALUES (p_username, p_type, p_amount, p_description);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Déduire des coins
CREATE OR REPLACE FUNCTION deduct_coins(
  p_username TEXT,
  p_amount BIGINT,
  p_type TEXT DEFAULT 'bet',
  p_description TEXT DEFAULT ''
)
RETURNS BIGINT AS $$
DECLARE
  v_new_balance BIGINT;
  v_current_balance BIGINT;
BEGIN
  SELECT coins INTO v_current_balance FROM players WHERE username = p_username;
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Solde insuffisant';
  END IF;

  UPDATE players
  SET coins = coins - p_amount,
      updated_at = NOW()
  WHERE username = p_username
  RETURNING coins INTO v_new_balance;

  INSERT INTO transactions(username, type, amount, description)
  VALUES (p_username, p_type, -p_amount, p_description);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mettre à jour stats après une partie
CREATE OR REPLACE FUNCTION update_player_stats(
  p_username TEXT,
  p_won BOOLEAN,
  p_coins_change BIGINT
)
RETURNS VOID AS $$
BEGIN
  UPDATE players SET
    games_played = games_played + 1,
    wins = wins + CASE WHEN p_won THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN NOT p_won THEN 1 ELSE 0 END,
    coins = GREATEST(0, coins + p_coins_change),
    xp = xp + CASE WHEN p_won THEN 100 ELSE 25 END,
    level = GREATEST(1, (xp + CASE WHEN p_won THEN 100 ELSE 25 END) / 1000 + 1),
    updated_at = NOW()
  WHERE username = p_username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== ROW LEVEL SECURITY =====
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;

-- Joueurs: lecture publique, écriture propre compte
CREATE POLICY "Public read" ON players FOR SELECT USING (true);
CREATE POLICY "Self update" ON players FOR UPDATE USING (auth.uid()::text = id::text);

-- Transactions: lecture propre compte
CREATE POLICY "Own transactions" ON transactions FOR SELECT
  USING (username = (SELECT username FROM players WHERE id = auth.uid()));

-- Historique: lecture propre compte
CREATE POLICY "Own history" ON game_history FOR SELECT
  USING (username = (SELECT username FROM players WHERE id = auth.uid()));

-- ===== DONNÉES DE TEST =====
INSERT INTO players (username, email, coins, wins, games_played, level)
VALUES
  ('Champion_01', 'champ@example.com', 250000, 312, 450, 45),
  ('LudoMaster',  'ludo@example.com',  180500, 245, 380, 38),
  ('ProGamer_CI', 'pro@example.com',    98700, 180, 290, 28)
ON CONFLICT (username) DO NOTHING;

INSERT INTO tournaments (name, entry_fee, prize_pool, max_players, status, starts_at, ends_at)
VALUES
  ('Grand Tournoi Clash of Coins', 2000, 500000, 256, 'active',
   NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days'),
  ('Tournoi du Soir', 1000, 50000, 64, 'upcoming',
   NOW() + INTERVAL '45 minutes', NOW() + INTERVAL '3 hours'),
  ('Clash Rapide', 500, 15000, 32, 'active',
   NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '3 hours'),
  ('Challenge du Champion', 2000, 100000, 60, 'upcoming',
   NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 4 hours')
ON CONFLICT DO NOTHING;
