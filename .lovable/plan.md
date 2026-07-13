## What's happening

The preview showed:

> Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY. Connect Supabase in Lovable Cloud.

From the checks I ran:

- The hosted backend is healthy.
- The project's `.env` still contains all six expected values (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`, and the three `VITE_` twins).
- No code was changed to how the Supabase client reads these variables.

So this isn't a code bug — it's the managed env not being present in the running preview sandbox at the moment that request was served (a stale worker started before `.env` was materialized). The stock recovery is a dev-server restart so the fresh env is picked up.

## Plan

1. Restart the preview dev server so it re-reads `.env` with the current Supabase values.
2. Reload the site and confirm `/` renders and Supabase-backed calls (e.g. sign-in page, `/courses`) work.
3. If the error returns after restart, refresh the Lovable Cloud integration to regenerate the managed `.env`, then restart again.

No source files will change.

## Technical notes

- `src/integrations/supabase/client.ts` reads `import.meta.env.VITE_SUPABASE_URL` with a `process.env.SUPABASE_URL` SSR fallback — both are present in `.env`, so no client edits are needed.
- `.env` is git-ignored (expected for the classic Vite/managed-Supabase setup); we won't commit it.
