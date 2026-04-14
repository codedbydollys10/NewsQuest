alter table public.user_activity_days
  add column if not exists streak_count integer not null default 0;

alter table public.user_activity_days
  add column if not exists last_active_at timestamptz;

update public.user_activity_days
set
  streak_count = coalesce(streak_count, 0),
  last_active_at = coalesce(last_active_at, updated_at, created_at, now());
