-- Hörakustik Daugsch · Portal · Beratung
-- Kann gefahrlos erneut ausgeführt werden.

create table if not exists public.consultations (
  id              uuid primary key,
  customer_name   text,
  customer_phone  text,
  data            jsonb not null default '{}'::jsonb,
  stage_rec       text,
  stage_final     text,
  device_id       uuid references public.devices(id) on delete set null,
  status          text not null default 'offen' check (status in ('offen','abgeschlossen')),
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists consultations_updated_idx on public.consultations(updated_at desc);

grant select, insert, update, delete on public.consultations to authenticated;
revoke all on public.consultations from anon;
alter table public.consultations enable row level security;
drop policy if exists "Team liest" on public.consultations;
drop policy if exists "Team schreibt" on public.consultations;
create policy "Team liest"    on public.consultations for select to authenticated using (true);
create policy "Team schreibt" on public.consultations for all    to authenticated using (true) with check (true);

-- Aufgaben mit Beratung verknüpfen
alter table public.tasks add column if not exists consultation_id text;
