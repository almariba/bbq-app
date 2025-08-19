-- PATCH: Soporte de múltiples realizadores por tarea
-- Crea tabla para asociar una o más personas a una tarea realizada
create table if not exists public.task_performers (
  id bigserial primary key,
  task_id bigint not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (task_id, user_id)
);

-- RLS abierta (MVP)
alter table public.task_performers enable row level security;
drop policy if exists "task_performers_all" on public.task_performers;
create policy "task_performers_all" on public.task_performers
  for all to anon, authenticated using (true) with check (true);
