create extension if not exists pgcrypto;

create table if not exists public.user_activity_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  total_events integer not null default 0,
  article_reads integer not null default 0,
  quiz_answers integer not null default 0,
  prediction_locks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, activity_date)
);

create index if not exists user_activity_days_user_id_activity_date_idx
  on public.user_activity_days (user_id, activity_date desc);

create or replace function public.touch_user_activity_days_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_user_activity_days_updated_at on public.user_activity_days;

create trigger trg_touch_user_activity_days_updated_at
before update on public.user_activity_days
for each row
execute function public.touch_user_activity_days_updated_at();

alter table public.user_activity_days enable row level security;

drop policy if exists "Users can read own activity days" on public.user_activity_days;
create policy "Users can read own activity days"
on public.user_activity_days
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own activity days" on public.user_activity_days;
create policy "Users can insert own activity days"
on public.user_activity_days
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own activity days" on public.user_activity_days;
create policy "Users can update own activity days"
on public.user_activity_days
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
