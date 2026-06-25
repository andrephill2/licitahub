-- LicitaHub — Schema Supabase
-- Execute no SQL Editor do Supabase (https://app.supabase.com → SQL Editor)

-- ─────────────────────────────────────────────
-- 1. PROFILES (vinculado ao auth.users do Supabase)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT UNIQUE NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('master', 'common')) DEFAULT 'common',
  expiration_date DATE NOT NULL DEFAULT '2099-12-31',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seu próprio perfil; master vê todos
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- ─────────────────────────────────────────────
-- 2. FAVORITOS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favoritos (
  id        SERIAL PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id   TEXT NOT NULL,
  item_data JSONB NOT NULL,
  saved_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favoritos_own" ON public.favoritos FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3. STATUS DOS ITENS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.item_statuses (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id         TEXT NOT NULL,
  fase            TEXT,
  posicionamento  TEXT,
  go              BOOLEAN,
  prazo_lance     TIMESTAMPTZ,
  prazo_esclarec  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE public.item_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "statuses_own" ON public.item_statuses FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 4. TRIGGER: cria perfil automaticamente ao signup
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, expiration_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'common'),
    COALESCE((NEW.raw_user_meta_data->>'expiration_date')::date, '2099-12-31')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────
-- 5. SEED: usuário master inicial
-- Execute UMA VEZ após rodar o schema.
-- Substitua a senha antes de executar.
-- ─────────────────────────────────────────────
-- SELECT supabase_admin.create_user(
--   '{"email": "andre.philipe@licitahub.internal", "password": "SUA-SENHA-AQUI", "email_confirm": true,
--     "user_metadata": {"username": "andre.philipe", "role": "master", "expiration_date": "2099-12-31"}}'
-- );
