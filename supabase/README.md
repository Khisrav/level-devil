# Supabase backend

Project: `level-devil` (ref `fedtvjkokephaosvsovu`, eu-central-1).
The schema was applied as migration `leaderboard_schema`.

- `players`: name (nickname, unique, case-insensitive), real_name (private, for prizes), bcrypt PIN hash, DiceBear avatar seed, levels_cleared, deaths
- `sessions`: random token per login
- RLS is on with no policies, so the browser can't read the tables directly.
  Everything goes through these RPCs (see `api.js`):
  `register`, `login` (5 wrong PINs → 5 min lock), `me`, `logout`,
  `report_deaths` (counts only on the first uncleared level),
  `complete_level` (only the next level, max 30), `get_leaderboard`.

Who gets the prize (Supabase SQL editor; real names never reach the browser):

```sql
select * from public.prize_list limit 10;
```

Reset the leaderboard:

```sql
truncate public.players cascade;
```
