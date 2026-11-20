-- Hörakustik Daugsch · Portal · Phase 1: Preistool
-- Kann gefahrlos erneut ausgeführt werden.

-- Allgemeine Einstellungen (z. B. Kassenanteil je Seite)
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);

-- 11 interne Preiskategorien (EK -> VK), je einer der 6 Kundenstufen zugeordnet
create table if not exists public.price_bands (
  id          text primary key,
  name        text not null,
  stage       text not null check (stage in ('basis','komfort','balance','praezision','exzellenz','perfektion')),
  ek_from     numeric not null,
  ek_to       numeric,
  vk_private  numeric not null,
  sort        int not null
);

-- Zusatzpositionen (Ex-Hörer, Ladegeräte, Otoplastik)
create table if not exists public.extras (
  id          text primary key,
  name        text not null,
  kind        text not null check (kind in ('receiver','charger','otoplastic','other')),
  price_private numeric not null,
  price_gkv   numeric not null,
  billing     text not null check (billing in ('side','fitting')),
  note        text,
  sort        int not null default 0
);

-- Geräte (Hersteller/Modell mit EK, Preislogik wird automatisch erkannt)
create table if not exists public.devices (
  id            uuid primary key default gen_random_uuid(),
  manufacturer  text not null,
  model         text not null,
  form          text not null default 'RIC',
  power         text not null default 'Akku',
  ek            numeric not null,
  receiver      boolean not null default false,
  charger_id    text references public.extras(id) on delete set null,
  otoplastic    boolean not null default false,
  features      text,
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.settings, public.price_bands, public.extras, public.devices to authenticated;
revoke all on public.settings, public.price_bands, public.extras, public.devices from anon;
alter table public.settings    enable row level security;
alter table public.price_bands enable row level security;
alter table public.extras      enable row level security;
alter table public.devices     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','price_bands','extras','devices'] loop
    execute format('drop policy if exists "Team liest" on public.%I', t);
    execute format('drop policy if exists "Team schreibt" on public.%I', t);
    execute format('create policy "Team liest" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "Team schreibt" on public.%I for all to authenticated using (true) with check (true)', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Startwerte (Preise) werden NICHT im öffentlichen Projekt gespeichert,
-- sondern einmalig separat in Supabase eingespielt.
