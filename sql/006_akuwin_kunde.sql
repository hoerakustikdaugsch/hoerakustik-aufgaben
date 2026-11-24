-- AkuWin-Kundennummer an Aufgaben und Laboraufträgen
alter table public.tasks      add column if not exists akuwin_id bigint;
alter table public.lab_orders add column if not exists akuwin_id bigint;
