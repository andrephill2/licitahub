-- LicitaHub — Schema inicial
-- Executar no Supabase SQL Editor ou psql

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('master', 'common')),
  expiration_date DATE NOT NULL DEFAULT '2099-12-31',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favoritos (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  item_data   JSONB NOT NULL,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS item_statuses (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id         TEXT NOT NULL,
  fase            TEXT,
  posicionamento  TEXT,
  go              BOOLEAN,
  prazo_lance     TIMESTAMPTZ,
  prazo_esclarec  TIMESTAMPTZ,
  prazo_propostas TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS search_tabs (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tab_key     TEXT NOT NULL,
  label       TEXT NOT NULL,
  config      JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tab_key)
);

-- Seed: usuário master inicial (senha deve ser atualizada via bcrypt)
-- INSERT INTO users (id, username, password_hash, role) VALUES ('admin-master', 'andre.philipe', '$2a$10$...', 'master');
