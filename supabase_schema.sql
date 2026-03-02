-- Texas Hold'em schema (idempotent, no admin features)
-- Run this whole file in Supabase SQL Editor (role: postgres).

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  total_games integer not null default 0,
  winning_games integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists total_games integer not null default 0;

alter table public.profiles
add column if not exists winning_games integer not null default 0;

create table if not exists public.sessions (
  id text primary key,
  created_at timestamptz not null default now(),
  status text not null default 'active'
);

alter table public.sessions
add column if not exists owner_id uuid;

alter table public.sessions
add column if not exists rmb_per_2000 numeric(12,2) not null default 100;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_owner_id_fkey'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_owner_id_fkey
      foreign key (owner_id) references public.profiles(id) on delete set null;
  end if;
end $$;

update public.sessions
set rmb_per_2000 = 100
where rmb_per_2000 is null;

create table if not exists public.room_players (
  room_id text not null,
  player_id uuid not null references public.profiles(id) on delete cascade,
  buy_in numeric(12,2) not null default 0,
  final_chips numeric(12,2),
  updated_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

create table if not exists public.session_players (
  id bigserial primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  buy_in numeric(12,2) not null,
  final_chips numeric(12,2) not null,
  net_result numeric(12,2) not null
);

create table if not exists public.transfers (
  id bigserial primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  from_player_id uuid not null references public.profiles(id) on delete cascade,
  to_player_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null
);

-- Remove legacy admin artifacts

drop table if exists public.admins cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.bootstrap_admin_account(text) cascade;

-- ------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------

create index if not exists idx_room_players_room_id on public.room_players(room_id);
create index if not exists idx_session_players_player_id on public.session_players(player_id);
create index if not exists idx_transfers_session_id on public.transfers(session_id);
create index if not exists idx_sessions_owner_id on public.sessions(owner_id);

-- Normalize existing duplicate nicknames safely.
with dup as (
  select
    id,
    nickname,
    row_number() over (partition by lower(nickname) order by created_at asc, id asc) as rn
  from public.profiles
)
update public.profiles p
set nickname = p.nickname || '_' || left(p.id::text, 4)
from dup
where p.id = dup.id
  and dup.rn > 1;

-- Case-insensitive unique nickname.
do $$
begin
  if exists (
    select 1
    from public.profiles
    group by lower(nickname)
    having count(*) > 1
  ) then
    raise notice 'Duplicate nicknames already exist. Skip unique index creation. Please clean duplicates then rerun.';
  else
    execute 'create unique index if not exists idx_profiles_nickname_ci_unique on public.profiles (lower(nickname));';
  end if;
end $$;

-- ------------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------------

create or replace function public.touch_room_players_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_room_players_updated_at on public.room_players;
create trigger trg_touch_room_players_updated_at
before update on public.room_players
for each row execute procedure public.touch_room_players_updated_at();

create or replace function public.refresh_profile_stats(target_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_winning integer := 0;
begin
  select
    count(*)::integer,
    count(*) filter (where sp.net_result > 0)::integer
  into v_total, v_winning
  from public.session_players sp
  where sp.player_id = target_player_id;

  update public.profiles p
  set
    total_games = coalesce(v_total, 0),
    winning_games = coalesce(v_winning, 0)
  where p.id = target_player_id;
end;
$$;

create or replace function public.trg_refresh_profile_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_profile_stats(new.player_id);
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.refresh_profile_stats(new.player_id);
    if old.player_id is distinct from new.player_id then
      perform public.refresh_profile_stats(old.player_id);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.refresh_profile_stats(old.player_id);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_session_players_refresh_profile_stats on public.session_players;
create trigger trg_session_players_refresh_profile_stats
after insert or update or delete on public.session_players
for each row execute procedure public.trg_refresh_profile_stats();

-- Backfill owner_id for legacy sessions (pick earliest room member by updated_at).
update public.sessions s
set owner_id = (
  select rp.player_id
  from public.room_players rp
  where rp.room_id = s.id
  order by rp.updated_at asc
  limit 1
)
where s.owner_id is null;

-- Backfill profile counters for existing data.
update public.profiles p
set
  total_games = coalesce(agg.total_games, 0),
  winning_games = coalesce(agg.winning_games, 0)
from (
  select
    sp.player_id,
    count(*)::integer as total_games,
    count(*) filter (where sp.net_result > 0)::integer as winning_games
  from public.session_players sp
  group by sp.player_id
) agg
where p.id = agg.player_id;

update public.profiles
set total_games = 0,
    winning_games = 0
where id not in (select distinct player_id from public.session_players);

-- ------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.room_players enable row level security;
alter table public.sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.transfers enable row level security;

-- ------------------------------------------------------------------
-- Helper functions
-- ------------------------------------------------------------------

create or replace function public.is_room_member(target_room_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_players rp
    where rp.room_id = target_room_id
      and rp.player_id = auth.uid()
  );
$$;

grant execute on function public.is_room_member(text) to authenticated;

create or replace function public.is_room_owner(target_room_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions s
    where s.id = target_room_id
      and s.owner_id = auth.uid()
  );
$$;

grant execute on function public.is_room_owner(text) to authenticated;

create or replace function public.can_settle_room(target_room_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions s
    where s.id = target_room_id
      and (
        s.owner_id = auth.uid()
        or (s.owner_id is null and public.is_room_member(target_room_id))
      )
  );
$$;

grant execute on function public.can_settle_room(text) to authenticated;

create or replace function public.nickname_exists(target_nickname text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where lower(p.nickname) = lower(target_nickname)
  );
$$;

grant execute on function public.nickname_exists(text) to anon, authenticated;

create or replace function public.resolve_login_emails(target_nickname text)
returns text[]
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    array_agg(distinct lower(u.email)) filter (where u.email is not null),
    array[]::text[]
  )
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.nickname) = lower(target_nickname);
$$;

grant execute on function public.resolve_login_emails(text) to anon, authenticated;

-- ------------------------------------------------------------------
-- Policies
-- ------------------------------------------------------------------

-- profiles

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
for select to authenticated
using (true);

drop policy if exists "profiles write own" on public.profiles;
create policy "profiles write own" on public.profiles
for all to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles admin manage" on public.profiles;

-- room_players

drop policy if exists "room players read" on public.room_players;
create policy "room players read" on public.room_players
for select to authenticated
using (true);

drop policy if exists "room players insert own" on public.room_players;
create policy "room players insert own" on public.room_players
for insert to authenticated
with check (auth.uid() = player_id);

drop policy if exists "room players update own" on public.room_players;
drop policy if exists "room players update own_or_owner" on public.room_players;
create policy "room players update own_or_owner" on public.room_players
for update to authenticated
using (auth.uid() = player_id or public.is_room_owner(room_id))
with check (auth.uid() = player_id or public.is_room_owner(room_id));

drop policy if exists "room players delete own" on public.room_players;
drop policy if exists "room players delete own_or_owner" on public.room_players;
create policy "room players delete own_or_owner" on public.room_players
for delete to authenticated
using (auth.uid() = player_id or public.is_room_owner(room_id));

-- sessions

drop policy if exists "sessions read" on public.sessions;
create policy "sessions read" on public.sessions
for select to authenticated
using (true);

drop policy if exists "sessions insert by member" on public.sessions;
drop policy if exists "sessions insert by owner" on public.sessions;
create policy "sessions insert by owner" on public.sessions
for insert to authenticated
with check (
  public.is_room_member(id)
  and (owner_id is null or owner_id = auth.uid())
);

drop policy if exists "sessions update by member" on public.sessions;
drop policy if exists "sessions update by owner" on public.sessions;
create policy "sessions update by owner" on public.sessions
for update to authenticated
using (public.can_settle_room(id))
with check (public.can_settle_room(id));

drop policy if exists "sessions delete by member" on public.sessions;
drop policy if exists "sessions delete by owner" on public.sessions;
create policy "sessions delete by owner" on public.sessions
for delete to authenticated
using (public.can_settle_room(id));

-- session_players

drop policy if exists "session players read" on public.session_players;
create policy "session players read" on public.session_players
for select to authenticated
using (true);

drop policy if exists "session players insert by member" on public.session_players;
drop policy if exists "session players insert by owner" on public.session_players;
create policy "session players insert by owner" on public.session_players
for insert to authenticated
with check (public.can_settle_room(session_id));

drop policy if exists "session players update by member" on public.session_players;
drop policy if exists "session players update by owner" on public.session_players;
create policy "session players update by owner" on public.session_players
for update to authenticated
using (public.can_settle_room(session_id))
with check (public.can_settle_room(session_id));

drop policy if exists "session players delete by member" on public.session_players;
drop policy if exists "session players delete by owner" on public.session_players;
create policy "session players delete by owner" on public.session_players
for delete to authenticated
using (public.can_settle_room(session_id));

-- transfers

drop policy if exists "transfers read" on public.transfers;
create policy "transfers read" on public.transfers
for select to authenticated
using (true);

drop policy if exists "transfers insert by member" on public.transfers;
drop policy if exists "transfers insert by owner" on public.transfers;
create policy "transfers insert by owner" on public.transfers
for insert to authenticated
with check (public.can_settle_room(session_id));

drop policy if exists "transfers update by member" on public.transfers;
drop policy if exists "transfers update by owner" on public.transfers;
create policy "transfers update by owner" on public.transfers
for update to authenticated
using (public.can_settle_room(session_id))
with check (public.can_settle_room(session_id));
 
drop policy if exists "transfers delete by member" on public.transfers;
drop policy if exists "transfers delete by owner" on public.transfers;
create policy "transfers delete by owner" on public.transfers
for delete to authenticated
using (public.can_settle_room(session_id));

commit;

-- Refresh PostgREST schema cache immediately.
notify pgrst, 'reload schema';
