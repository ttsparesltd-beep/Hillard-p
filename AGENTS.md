# Notes for anyone (human or AI) changing this repo

- Static multi-page site (root `hillard-*.html`, Supabase from CDN). Not Next.js. Deployed to Vercel from `main`. Andy often uploads files through the GitHub web UI, so a file can get missed: check the live site after a deploy.
- Supabase project ref: `ixgotsabbqkkxzsxnwtr`. Edge functions and migrations are kept in `supabase/` for reference. They are deployed separately, not by Vercel.
- **Statuses:** read `STATE_MACHINES.md` before touching any `status` column. Valid values and transitions are in `hillard-states.js` and are enforced by CHECK constraints. Don't write a status string that isn't listed there.
- **Confirming a booking** must go through the `booking-confirm` edge function (POST `{id, date?}`), never a direct `update({status:'confirmed'})`. Going through the function means the customer is emailed exactly once.
- **Links must never change data.** Email scanners open them automatically.
- Supabase edge functions serve HTML as `text/plain` with a sandbox CSP, so user-facing pages belong on hillardperformance.com, not in a function.
- Pages that use `window.HP_STATES` keep a local fallback. Keep that pattern.
