-- LicitaTrend — Migração consolidada (2026-07-01)
-- Rode UMA vez no Supabase: painel > SQL Editor > New query > cole tudo e Run.
-- Seguro para rodar mais de uma vez (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- Parte 1: tabela de notificações in-app (sino do topo)
-- Parte 2: novas colunas em item_statuses (Sala de Análise sai do localStorage
--          e passa a sincronizar entre dispositivos/usuários)

-- ─────────────────────────────────────────────────────────────
-- PARTE 1 — Notificações in-app
-- ─────────────────────────────────────────────────────────────
create table if not exists public.notificacoes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,  -- destinatário
  title      text not null,
  body       text not null,
  item_id    text,          -- id da licitação (opcional)
  fase       text,          -- fase que disparou o alerta (opcional)
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notificacoes_user_idx
  on public.notificacoes (user_id, created_at desc);

alter table public.notificacoes enable row level security;

-- Cada usuário só enxerga / gerencia as próprias notificações
drop policy if exists notif_select_own on public.notificacoes;
create policy notif_select_own on public.notificacoes
  for select using (auth.uid() = user_id);

drop policy if exists notif_update_own on public.notificacoes;
create policy notif_update_own on public.notificacoes
  for update using (auth.uid() = user_id);

drop policy if exists notif_delete_own on public.notificacoes;
create policy notif_delete_own on public.notificacoes
  for delete using (auth.uid() = user_id);

-- Qualquer usuário autenticado pode CRIAR uma notificação para outro
-- (ex.: mover um card para a fase do colega e avisá-lo)
drop policy if exists notif_insert_auth on public.notificacoes;
create policy notif_insert_auth on public.notificacoes
  for insert with check (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────
-- PARTE 2 — Sala de Análise: novas colunas em item_statuses
-- ─────────────────────────────────────────────────────────────
alter table public.item_statuses add column if not exists responsavel text;
alter table public.item_statuses add column if not exists drive_url   text;
alter table public.item_statuses add column if not exists itens       jsonb;  -- decisão por item/lote {numeroItem: {participar, precoAlvo, obs}}
alter table public.item_statuses add column if not exists habilitacao jsonb;  -- checklist de documentos {doc: boolean}
alter table public.item_statuses add column if not exists exigencias  jsonb;  -- flags críticas {flag: boolean}
