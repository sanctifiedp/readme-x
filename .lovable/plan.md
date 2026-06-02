## Root cause

`adeyigbeminiyi414@gmail.com` is a real super admin (has `student`, `admin`, and `super_admin` rows in `user_roles`). Creating a question bank fails because of a bug in the admin check, not a missing role.

In `src/lib/courses.functions.ts` and `src/lib/tournaments.functions.ts`, `assertAdmin` runs:

```ts
.from("user_roles").select("role").eq("user_id", userId)
  .in("role", ["admin","super_admin"]).maybeSingle();
```

A super admin matches **two** rows (`admin` + `super_admin`). `.maybeSingle()` rejects any result with more than one row, so `data` comes back `null` and the function throws `"Forbidden: admin only"` — exactly the message the user is seeing when adding a course / uploading material / generating questions.

The single-role helpers in `admin.functions.ts`, `notes.functions.ts`, `chat.functions.ts`, `donations.functions.ts` use `.eq("role","admin")` so they're unaffected.

## Fix

1. **`src/lib/courses.functions.ts`** — change `assertAdmin` to tolerate multiple matching roles:
   ```ts
   .in("role", ["admin","super_admin"]).limit(1).maybeSingle();
   ```
2. **`src/lib/tournaments.functions.ts`** — same one-line fix.

No schema change, no migration, no UI change. Pure server-fn bugfix that unblocks every admin/super-admin write path on courses, materials, questions (manual + AI), and tournament management.

## Verification

After the edit, signed in as `adeyigbeminiyi414@gmail.com`:
- Create a new course → succeeds.
- Upload a material / AI-generate questions / add a question manually → succeeds.
- Create / edit / delete a tournament → succeeds.
- Non-admin account still gets `Forbidden: admin only`.

## Out of scope for this turn

Unfinished features (Admin Tournaments CRUD tab, Schools/Departments admin, Friends + challenges, Announcements/notifications) — happy to pick one up next once this blocker is cleared.