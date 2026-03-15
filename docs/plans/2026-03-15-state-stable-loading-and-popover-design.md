# State-Stable Loading and Responsive Buy-In Popover Design

## Context
The current app already improved first-load performance by deferring leaderboard and history data until the related tab is visited. Two follow-up issues remain:

1. State stability is still weaker than it should be. When room data refreshes, the UI can briefly look like it is resetting instead of preserving the in-room state until fresh data arrives.
2. The buy-in history popover is now data-correct, but on mobile it overflows the player card and gets clipped by the horizontal player-card scroller.
3. Additional wasted refreshes happen because leaderboard/history reload even when the settled-session count has not changed.
4. "All players" data should not block the normal in-room path.

The user chose the "A" performance posture: prefer stable in-room experience and keep current UI visible until genuinely new data arrives.

## Goals
- Preserve current in-room state while async refreshes happen.
- Avoid leaderboard/history refetches when the number of settled sessions has not changed.
- Delay all-player specific work until the user actually switches to `全部玩家`.
- Keep buy-in history readable on mobile by using an in-card downward popover on mobile and a side popover on larger screens.

## Approaches

### Option 1: Add more loading placeholders everywhere
- Keep current request graph mostly intact.
- Show more loaders/skeletons while refetching.

Trade-offs:
- Easiest to patch visually.
- Does not solve the underlying unnecessary work or state resets.
- Still causes the room view to feel unstable.

Rejected because it treats symptoms, not the root cause.

### Option 2: Keep stale state until fresh state arrives, plus conditional refresh keys
- Do not clear room/leaderboard/history arrays before replacement.
- Introduce cheap freshness signals (settled session count / current room membership state) to decide whether a fetch is necessary.
- Lazy-load all-player specific datasets only after entering the `全部玩家` mode.
- Make the buy-in popover responsive by changing placement rules per breakpoint.

Trade-offs:
- Slightly more state bookkeeping.
- Best match for the user goal of stable UI.
- Low bug risk because the current data model remains intact.

Recommended.

### Option 3: Centralize everything in a cache library
- Move the app to a cache/query layer such as TanStack Query.

Trade-offs:
- Long-term attractive.
- Too much moving surface for a hot UX/performance pass.
- High regression risk in a large existing single-file app.

Rejected for now.

## Approved Design

### State Stability
- Room state remains rendered until the replacement fetch succeeds.
- Avoid clearing `players`, `historySessions`, `leaderboardRows`, and current room metadata at refresh boundaries unless the app is truly leaving the room or logging out.
- Persisted room restoration should reuse the existing room UI shell while a refresh runs; no deliberate fallback to the landing state.

### Conditional Refresh
- Track a light freshness signature for settled sessions, based on session count in the relevant scope.
- Skip leaderboard/history refetch when the settled count hasn't changed.
- Continue to invalidate on real mutations that can change visible content, but avoid blind refresh cascades.

### Delayed `全部玩家` Work
- Treat the `全部玩家` view as a second-stage room workload.
- Only fetch/refresh any room-owner/player-directory work once the user actually enters that tab.
- Keep the `仅看我` path lightweight.

### Buy-In History Popover
- Mobile (`< sm`): render as a card-local dropdown below the cumulative buy-in row, constrained to the card width.
- Desktop (`>= sm`): keep a side popover anchored to the info trigger.
- Same glass styling, same close-on-outside-click behavior.

### Testing
- Add targeted unit tests for popover class selection.
- Add tests for refresh policy / freshness gates if extracted into helpers.
- Run full suite and production build before deploy.

