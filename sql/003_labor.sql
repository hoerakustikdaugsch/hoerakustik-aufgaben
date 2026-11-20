-- Hörakustik Daugsch · Portal · Labor (Otoplastik-Fertigung)
-- Kann gefahrlos erneut ausgeführt werden.

create table if not exists public.lab_orders (
  id              uuid primary key default gen_random_uuid(),
  customer        text not null,
  phone           text,
  consultation_id text,
  sides           text not null default 'beide' check (sides in ('rechts','links','beide')),
  spec            jsonb not null default '{}'::jsonb,
  stage           int  not null default 0 check (stage between 0 and 6),
  history         jsonb not null default '[]'::jsonb,
  due             date,
  urgent          boolean not null default false,
  assignee        uuid references public.profiles(id) on delete set null,
  notes           text,
  delivered_at    timestamptz,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists lab_orders_open_idx on public.lab_orders(delivered_at, stage);

grant select, insert, update, delete on public.lab_orders to authenticated;
revoke all on public.lab_orders from anon;
alter table public.lab_orders enable row level security;
drop policy if exists "Team liest" on public.lab_orders;
drop policy if exists "Team schreibt" on public.lab_orders;
create policy "Team liest"    on public.lab_orders for select to authenticated using (true);
create policy "Team schreibt" on public.lab_orders for all    to authenticated using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table public.lab_orders;
exception when duplicate_object then null; end $$;
