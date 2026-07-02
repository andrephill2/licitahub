-- LicitaTrend — Notificações in-app (alerta de fase para o colaborador responsável)
-- Rode uma única vez no Supabase: painel > SQL Editor > New query > cole e Run.
-- Seguro para rodar mais de uma vez (IF NOT EXISTS / DROP POLICY IF EXISTS).

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
