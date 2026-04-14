create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text not null,
  avatar_id integer not null default 0,
  avatar_customization jsonb not null default '{"skinTone":0,"trailColor":"cyan"}'::jsonb,
  current_level integer not null default 1,
  total_xp integer not null default 0,
  xp_to_next_level integer not null default 100,
  streak_count integer not null default 0,
  last_active_date timestamptz not null default now(),
  interests text[] not null default '{}'::text[],
  daily_goal integer not null default 5,
  mode text not null default 'both',
  badges text[] not null default '{}'::text[],
  articles_read integer not null default 0,
  quizzes_total integer not null default 0,
  quizzes_correct integer not null default 0,
  predictions_total integer not null default 0,
  predictions_correct integer not null default 0,
  battle_rating integer not null default 1000,
  battle_tier text not null default 'ROOKIE',
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  recent_form text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_id integer not null default 0;
alter table public.profiles add column if not exists avatar_customization jsonb not null default '{"skinTone":0,"trailColor":"cyan"}'::jsonb;
alter table public.profiles add column if not exists current_level integer not null default 1;
alter table public.profiles add column if not exists total_xp integer not null default 0;
alter table public.profiles add column if not exists xp_to_next_level integer not null default 100;
alter table public.profiles add column if not exists streak_count integer not null default 0;
alter table public.profiles add column if not exists last_active_date timestamptz not null default now();
alter table public.profiles add column if not exists interests text[] not null default '{}'::text[];
alter table public.profiles add column if not exists daily_goal integer not null default 5;
alter table public.profiles add column if not exists mode text not null default 'both';
alter table public.profiles add column if not exists badges text[] not null default '{}'::text[];
alter table public.profiles add column if not exists articles_read integer not null default 0;
alter table public.profiles add column if not exists quizzes_total integer not null default 0;
alter table public.profiles add column if not exists quizzes_correct integer not null default 0;
alter table public.profiles add column if not exists predictions_total integer not null default 0;
alter table public.profiles add column if not exists predictions_correct integer not null default 0;
alter table public.profiles add column if not exists battle_rating integer not null default 1000;
alter table public.profiles add column if not exists battle_tier text not null default 'ROOKIE';
alter table public.profiles add column if not exists wins integer not null default 0;
alter table public.profiles add column if not exists losses integer not null default 0;
alter table public.profiles add column if not exists draws integer not null default 0;
alter table public.profiles add column if not exists recent_form text[] not null default '{}'::text[];
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_last_active_idx on public.profiles (last_active_date desc);
create index if not exists profiles_total_xp_idx on public.profiles (total_xp desc);

create or replace function public.touch_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.touch_profiles_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "Users can read profiles" on public.profiles;
create policy "Users can read profiles"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
