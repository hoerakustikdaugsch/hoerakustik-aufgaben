-- Laborauftrag ↔ Aufgabe: wer übernimmt den Auftrag, und welche Aufgabe gehört dazu
alter table public.lab_orders add column if not exists assignee uuid references public.profiles(id) on delete set null;
alter table public.tasks      add column if not exists lab_order_id text;
create index if not exists tasks_lab_order_idx on public.tasks(lab_order_id);
