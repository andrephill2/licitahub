-- Prazo manual de contrarrazão por processo (TrackingCard "+ Contrarraz.").
-- Sem esta coluna o app continua funcionando (fallback grava só os campos
-- legados e a contrarrazão fica no localStorage); com ela, sincroniza entre
-- dispositivos como os demais prazos manuais.
-- Rodar no SQL Editor do Supabase:

alter table public.item_statuses
  add column if not exists prazo_contrarrazao text;
