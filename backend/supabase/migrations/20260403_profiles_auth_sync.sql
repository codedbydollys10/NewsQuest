-- Keep public.profiles in sync with auth.users metadata.
-- This runs on new signups and when auth metadata/email changes.

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists avatar_id bigint default 0;
alter table public.profiles add column if not exists level bigint default 1;
alter table public.profiles add column if not exists xp bigint default 0;
alter table public.profiles add column if not exists streak bigint default 0;
alter table public.profiles add column if not exists rank text default 'ROOKIE';
alter table public.profiles add column if not exists is_onboarded boolean default false;
alter table public.profiles add column if not exists created_at timestamptz default now();

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  username_value text;
  avatar_id_value bigint := 0;
  level_value bigint := 1;
  xp_value bigint := 0;
  streak_value bigint := 0;
  rank_value text := 'ROOKIE';
  onboarded_value boolean := false;
begin
  username_value := coalesce(nullif(trim(meta ->> 'username'), ''), split_part(coalesce(new.email, ''), '@', 1), 'player');
  rank_value := coalesce(nullif(trim(meta ->> 'battle_tier'), ''), nullif(trim(meta ->> 'rank'), ''), 'ROOKIE');
  onboarded_value := coalesce((meta ->> 'is_onboarded')::boolean, false);

  begin
    avatar_id_value := coalesce((meta ->> 'avatar_id')::bigint, (meta ->> 'avatarId')::bigint, 0);
  exception when others then
    avatar_id_value := 0;
  end;

  begin
    level_value := coalesce((meta ->> 'current_level')::bigint, (meta ->> 'level')::bigint, 1);
  exception when others then
    level_value := 1;
  end;

  begin
    xp_value := coalesce((meta ->> 'total_xp')::bigint, (meta ->> 'xp')::bigint, 0);
  exception when others then
    xp_value := 0;
  end;

  begin
    streak_value := coalesce((meta ->> 'streak_count')::bigint, (meta ->> 'streak')::bigint, 0);
  exception when others then
    streak_value := 0;
  end;

  insert into public.profiles (
    id,
    username,
    email,
    avatar_id,
    level,
    xp,
    streak,
    rank,
    is_onboarded,
    created_at
  ) values (
    new.id,
    username_value,
    new.email,
    avatar_id_value,
    greatest(level_value, 1),
    greatest(xp_value, 0),
    greatest(streak_value, 0),
    rank_value,
    onboarded_value,
    coalesce(new.created_at, now())
  )
  on conflict (id) do update
  set
    username = excluded.username,
    email = excluded.email,
    avatar_id = excluded.avatar_id,
    level = excluded.level,
    xp = excluded.xp,
    streak = excluded.streak,
    rank = excluded.rank,
    is_onboarded = excluded.is_onboarded;

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_from_auth_user on auth.users;
create trigger trg_sync_profile_from_auth_user
after insert or update of email, raw_user_meta_data
on auth.users
for each row
execute function public.sync_profile_from_auth_user();

-- Backfill existing auth users into profiles.
insert into public.profiles (id, username, email, avatar_id, level, xp, streak, rank, is_onboarded, created_at)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''), split_part(coalesce(u.email, ''), '@', 1), 'player') as username,
  u.email,
  case
    when coalesce(u.raw_user_meta_data ->> 'avatar_id', u.raw_user_meta_data ->> 'avatarId', '') ~ '^-?\d+$'
      then coalesce((u.raw_user_meta_data ->> 'avatar_id')::bigint, (u.raw_user_meta_data ->> 'avatarId')::bigint, 0)
    else 0
  end as avatar_id,
  case
    when coalesce(u.raw_user_meta_data ->> 'current_level', u.raw_user_meta_data ->> 'level', '') ~ '^-?\d+$'
      then greatest(coalesce((u.raw_user_meta_data ->> 'current_level')::bigint, (u.raw_user_meta_data ->> 'level')::bigint, 1), 1)
    else 1
  end as level,
  case
    when coalesce(u.raw_user_meta_data ->> 'total_xp', u.raw_user_meta_data ->> 'xp', '') ~ '^-?\d+$'
      then greatest(coalesce((u.raw_user_meta_data ->> 'total_xp')::bigint, (u.raw_user_meta_data ->> 'xp')::bigint, 0), 0)
    else 0
  end as xp,
  case
    when coalesce(u.raw_user_meta_data ->> 'streak_count', u.raw_user_meta_data ->> 'streak', '') ~ '^-?\d+$'
      then greatest(coalesce((u.raw_user_meta_data ->> 'streak_count')::bigint, (u.raw_user_meta_data ->> 'streak')::bigint, 0), 0)
    else 0
  end as streak,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'battle_tier'), ''), nullif(trim(u.raw_user_meta_data ->> 'rank'), ''), 'ROOKIE') as rank,
  coalesce((u.raw_user_meta_data ->> 'is_onboarded')::boolean, false) as is_onboarded,
  coalesce(u.created_at, now()) as created_at
from auth.users u
on conflict (id) do update
set
  username = excluded.username,
  email = excluded.email,
  avatar_id = excluded.avatar_id,
  level = excluded.level,
  xp = excluded.xp,
  streak = excluded.streak,
  rank = excluded.rank,
  is_onboarded = excluded.is_onboarded;
