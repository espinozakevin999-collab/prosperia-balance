-- Ejecuta este archivo una sola vez en Supabase > SQL Editor.
-- Todas las tablas usan Row Level Security: cada persona solo ve sus propios datos.

create table if not exists public.transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14, 2) not null check (amount > 0),
  date date not null,
  description text not null check (char_length(description) between 1 and 100),
  category text not null check (char_length(category) between 1 and 60),
  personal boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 180),
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

alter table public.transactions enable row level security;

drop policy if exists "Users read own transactions" on public.transactions;
create policy "Users read own transactions" on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own transactions" on public.transactions;
create policy "Users insert own transactions" on public.transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own transactions" on public.transactions;
create policy "Users update own transactions" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own transactions" on public.transactions;
create policy "Users delete own transactions" on public.transactions
  for delete using (auth.uid() = user_id);

create table if not exists public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_budget numeric(14, 2) not null default 0 check (monthly_budget >= 0),
  updated_at timestamptz not null default now()
);

alter table public.preferences enable row level security;

drop policy if exists "Users read own preferences" on public.preferences;
create policy "Users read own preferences" on public.preferences
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own preferences" on public.preferences;
create policy "Users insert own preferences" on public.preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own preferences" on public.preferences;
create policy "Users update own preferences" on public.preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
