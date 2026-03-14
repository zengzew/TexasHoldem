# Buy-In History Popover and Background Motion Design

## Context
The current app already uses a glassmorphism visual system with account/date popovers, mesh lighting, and current-room player cards. The requested changes should stay inside that system and avoid adding a new interaction model or heavy rendering path.

## Goals
- Remove the background grid while preserving the current soft blue-violet atmosphere.
- Add subtle background motion without introducing janky Safari behavior.
- Add a small info trigger next to each player's cumulative buy-in value.
- Show a lightweight popover listing confirmed buy-in events for that player in chronological order.
- Update the room-owner helper copy to mention add/remove-player permissions.

## Constraints
- Keep UI language and visual style consistent with the existing glass popovers.
- Do not change current settlement, leaderboard, or room membership behavior.
- The buy-in event list only needs time precision to `HH:mm`, no date.
- Deployment target remains both Vercel and Cloudflare Pages.

## Approach Options

### Option 1: Reuse the existing player state only
Infer buy-in history from cumulative totals stored on the player row.

Trade-offs:
- No schema change.
- Impossible to reconstruct each confirmed buy-in event correctly.
- Breaks as soon as a player buys in multiple times or uses negative correction values.

Rejected because it cannot satisfy the requested history fidelity.

### Option 2: Add a dedicated `buy_in_events` table and a small popover
Persist one event per confirmed buy-in change. Keep the current player aggregate fields as-is and read the event list only when the user opens the info popover.

Trade-offs:
- Small schema and cleanup SQL changes.
- Clear event history with minimal runtime cost.
- Existing flows remain stable because aggregate state is unchanged.

Recommended because it is the lowest-risk way to add this feature without touching settlement math.

### Option 3: Store event JSON on the player row
Append confirmed buy-in events to a JSON array field on `session_players`.

Trade-offs:
- Fewer joins.
- Harder to query, migrate, clean up, and evolve.
- More brittle with realtime updates and concurrent edits.

Rejected because it adds unnecessary complexity to one hot row.

## Approved Design

### Background
- Remove the decorative grid layer from `src/index.css`.
- Keep the current mesh gradient base.
- Add a low-frequency, low-amplitude motion effect to the existing blur blobs so the page feels alive without obvious movement.
- Avoid transform-heavy floating overlays; prefer animated background-position / slight scale drift on existing layers to reduce Safari rendering issues.

### Buy-In History Interaction
- Add a compact circular `i` trigger aligned to the right of `累计总买入：____ 积分`.
- Clicking the trigger opens a glass popover anchored to that row.
- Popover content:
  - title such as `买入记录`
  - list ordered by `created_at ASC`
  - each row shows `HH:mm` on the left and signed amount on the right (`+2000`, `-1000`)
  - empty state: `暂无买入记录`
- Only one player's popover should be open at a time.
- Clicking outside closes it, matching the existing account/date picker behavior.

### Data Model
Create table `public.buy_in_events` with:
- `id uuid primary key default gen_random_uuid()`
- `room_id text not null references public.sessions(id) on delete cascade`
- `player_id uuid not null references public.profiles(id) on delete cascade`
- `amount numeric not null`
- `created_by uuid not null references public.profiles(id)`
- `created_at timestamptz not null default timezone('Asia/Shanghai', now())` or default `now()` with frontend Beijing formatting

Indexes:
- `(room_id, player_id, created_at)` for popover lookup.

RLS policy strategy:
- Read: any authenticated user can read events for rooms they belong to.
- Insert: only users who are allowed to confirm buy-ins in the room (self or owner under existing room-player rules).

### Runtime Flow
- Existing confirm-buy-in action continues updating cumulative buy-in on the player.
- On successful confirm, insert one `buy_in_events` row with the signed amount.
- When a room loads, no event list is fetched eagerly.
- Opening the popover triggers a room+player scoped fetch if the local cache is empty.
- Cache events in component state keyed by `roomId:playerId`.

### Copy Update
Replace:
- `房主可修改所有玩家的买入/最终积分和积分换算，并有权限结算本局。`
With:
- `房主可添加/移除玩家，修改所有玩家的买入/最终积分和积分换算，并有权限结算本局。`

### Testing
- Unit test buy-in history formatting and order.
- Integration-level UI tests for:
  - info trigger visible on player card
  - empty-state popover
  - signed event rendering in chronological order
- Regression test that confirm-buy-in still updates cumulative totals and now also records an event.

