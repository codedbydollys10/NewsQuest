alter table public.user_activity_days
  add column if not exists battle_matches integer not null default 0;

update public.user_activity_days
set battle_matches = coalesce(battle_matches, 0);
