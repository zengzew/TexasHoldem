-- 删除房间 20260613（房主: Jasmine）
-- 在 Supabase Dashboard -> SQL Editor 中执行（角色: postgres）
-- 注意：请在 生产 项目 mopdaqwieumjqusigfga.supabase.co 中执行
-- 安全保护：若房间不存在或房主不是 Jasmine，整个事务会回滚，不会删除任何数据

begin;

-- 0) 先查看该房间的现状（确认无误再继续）
select
  s.id,
  s.created_at,
  s.status,
  p.nickname as owner_nickname,
  (select count(*) from public.room_players rp where rp.room_id = s.id) as player_count,
  (select count(*) from public.session_players sp where sp.session_id = s.id) as settled_rows,
  (select count(*) from public.buy_in_events b where b.room_id = s.id) as buyin_events,
  (select count(*) from public.transfers t where t.session_id = s.id) as transfers
from public.sessions s
left join public.profiles p on p.id = s.owner_id
where s.id = '20260613';

-- 1) 校验：房间必须存在且房主是 Jasmine，否则中止并回滚
do $$
declare
  v_owner text;
begin
  select p.nickname
  into v_owner
  from public.sessions s
  left join public.profiles p on p.id = s.owner_id
  where s.id = '20260613';

  if v_owner is null then
    raise exception '房间 20260613 不存在或没有房主信息，已回滚';
  end if;

  if lower(v_owner) <> 'jasmine' then
    raise exception '房主是 % 而不是 Jasmine，已回滚', v_owner;
  end if;
end $$;

-- 2) 删除房间（级联删除 room_players / session_players / transfers / buy_in_events）
delete from public.sessions where id = '20260613';

-- 3) 确认删除结果（应为 0）
select count(*) as remaining_sessions from public.sessions where id = '20260613';

commit;
