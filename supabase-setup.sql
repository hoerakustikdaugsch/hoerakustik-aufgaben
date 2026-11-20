-- Hörakustik Daugsch · Aufgaben-App
-- Einmal im Supabase SQL Editor ausführen (SQL Editor → New query → einfügen → Run).
-- Kann gefahrlos erneut ausgeführt werden.

-- Personen im Team (eine Zeile pro Login)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- Aufgaben
create table if not exists public.tasks (
  id           text primary key,
  title        text not null,
  category     text not null default 'Sonstiges',
  assignee     uuid references public.profiles(id) on delete set null,
  due          date,
  priority     text not null default 'normal' check (priority in ('hoch','normal','niedrig')),
  status       text not null default 'offen'  check (status in ('offen','arbeit','wartet','erledigt')),
  prev_status  text,
  customer     text,
  phone        text,
  manufacturer text,
  model        text,
  notes        text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  done_at      timestamptz
);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_done_idx   on public.tasks(done_at desc);

-- Zugriff nur für angemeldete Team-Mitglieder
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.tasks to authenticated;
revoke all on public.profiles, public.tasks from anon;
alter table public.profiles enable row level security;
alter table public.tasks    enable row level security;

drop policy if exists "Team liest Profile"      on public.profiles;
drop policy if exists "Eigenes Profil anlegen"  on public.profiles;
drop policy if exists "Eigenes Profil aendern"  on public.profiles;
create policy "Team liest Profile"     on public.profiles for select to authenticated using (true);
create policy "Eigenes Profil anlegen" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "Eigenes Profil aendern" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Team liest Aufgaben"     on public.tasks;
drop policy if exists "Team legt Aufgaben an"   on public.tasks;
drop policy if exists "Team aendert Aufgaben"   on public.tasks;
drop policy if exists "Team loescht Aufgaben"   on public.tasks;
create policy "Team liest Aufgaben"   on public.tasks for select to authenticated using (true);
create policy "Team legt Aufgaben an" on public.tasks for insert to authenticated with check (true);
create policy "Team aendert Aufgaben" on public.tasks for update to authenticated using (true) with check (true);
create policy "Team loescht Aufgaben" on public.tasks for delete to authenticated using (true);

-- Live-Synchronisation zwischen allen Geräten einschalten
do $$
begin
  begin
    alter publication supabase_realtime add table public.tasks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
end $$;
