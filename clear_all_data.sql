-- Clear all app data before production release
-- Run in Supabase SQL Editor (role: postgres)

begin;

-- 1) Clear game data
truncate table public.transfers restart identity;
truncate table public.session_players restart identity;
truncate table public.room_players restart identity;
truncate table public.sessions restart identity;

-- 2) Clear app users created by this project (nickname -> synthetic email)
--    This will cascade to public.profiles because profiles.id references auth.users(id).
delete from auth.users
where email like 'u_%@holdem.local';

-- 3) Safety cleanup for any orphan profiles (should usually be empty)
delete from public.profiles p
where not exists (
  select 1 from auth.users u where u.id = p.id
);

commit;

notify pgrst, 'reload schema';
