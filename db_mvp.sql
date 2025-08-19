-- Esquema MVP para BBQ Manager (compatible DBeaver / Supabase)
-- NOTA DE SEGURIDAD: Políticas abiertas a 'anon' para facilidad de pruebas.
-- Endureceremos después con autenticación anónima y políticas por usuario/evento.

-- EXTENSIONES (en Supabase suelen estar listas)
-- create extension if not exists pgcrypto;

-- EVENTS
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date,
  code text unique not null, -- código corto para invitar (ej: ABC123)
  created_at timestamptz default now()
);

-- USERS (participantes)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  nickname text not null,
  created_at timestamptz default now(),
  constraint uq_user_nickname unique (event_id, nickname)
);

-- CATÁLOGO DE MENÚ
create table if not exists public.menu_items (
  id bigserial primary key,
  name text not null,
  category text not null, -- comida, bebida, otros
  unit text,              -- ud., l, kg
  price_estimate numeric(10,2)
);

-- SELECCIONES DE USUARIO
create table if not exists public.user_selections (
  id bigserial primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  menu_item_id bigint not null references public.menu_items(id) on delete restrict,
  qty integer not null default 0,
  updated_at timestamptz default now()
);
create index if not exists idx_user_selections_event on public.user_selections(event_id);
create index if not exists idx_user_selections_user on public.user_selections(user_id);

-- TAREAS
create table if not exists public.tasks (
  id bigserial primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  assigned_to uuid references public.users(id) on delete set null,
  status text not null default 'pending', -- pending | done
  created_by uuid references public.users(id) on delete set null,
  updated_at timestamptz default now()
);
create index if not exists idx_tasks_event on public.tasks(event_id);
alter table public.tasks add constraint tasks_status_chk check (status in ('pending','done'));

-- GASTOS
create table if not exists public.expenses (
  id bigserial primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  payer_user_id uuid not null references public.users(id) on delete set null,
  concept text not null,
  amount numeric(10,2) not null check (amount >= 0),
  created_at timestamptz default now()
);
create index if not exists idx_expenses_event on public.expenses(event_id);

-- POLÍTICAS RLS (apertura para pruebas)
alter table public.events enable row level security;
alter table public.users enable row level security;
alter table public.menu_items enable row level security;
alter table public.user_selections enable row level security;
alter table public.tasks enable row level security;
alter table public.expenses enable row level security;

-- Limpia políticas previas
drop policy if exists "events_all" on public.events;
drop policy if exists "users_all" on public.users;
drop policy if exists "menu_all" on public.menu_items;
drop policy if exists "selections_all" on public.user_selections;
drop policy if exists "tasks_all" on public.tasks;
drop policy if exists "expenses_all" on public.expenses;

-- Permitir SELECT/INSERT/UPDATE/DELETE a 'anon' y 'authenticated' (MVP)
create policy "events_all" on public.events
  for all to anon, authenticated using (true) with check (true);

create policy "users_all" on public.users
  for all to anon, authenticated using (true) with check (true);

create policy "menu_all" on public.menu_items
  for all to anon, authenticated using (true) with check (true);

create policy "selections_all" on public.user_selections
  for all to anon, authenticated using (true) with check (true);

create policy "tasks_all" on public.tasks
  for all to anon, authenticated using (true) with check (true);

create policy "expenses_all" on public.expenses
  for all to anon, authenticated using (true) with check (true);

-- SEED de menú básico
insert into public.menu_items (name, category, unit, price_estimate) values
  ('Hamburguesa', 'comida', 'ud.', 1.20),
  ('Salchicha', 'comida', 'ud.', 0.80),
  ('Panceta', 'comida', 'ud.', 1.00),
  ('Pan', 'otros', 'ud.', 0.30),
  ('Refresco', 'bebida', 'lata', 0.60),
  ('Cerveza', 'bebida', 'lata', 0.70),
  ('Mojito', 'bebida', 'vaso', 2.00),
  ('Gurrufalla', 'otros', 'ud.', 1.00),
  ('Hielo', 'otros', 'kg', 1.50),
  ('Carbón', 'otros', 'kg', 2.00)
on conflict do nothing;
