
# ReadMe V2.0 Foundation Plan

This is a large scope. To keep it safe and reviewable, I'll ship it in **4 batches**, each self-contained and non-breaking. Existing auth, admin, question bank, practice, tournaments, and RLS stay intact — everything below is additive.

Please confirm the batching before I start (or tell me to just go straight through).

---

## Batch A — Data + Identity foundation

Additive migration only. No UI changes yet.

New/extended tables:
- `profiles`: add `username` (unique, citext, `^[a-zA-Z0-9_]{3,20}$`), `avatar_url`, `xp` (int, default 0), `streak_count`, `streak_last_day`, `faculty`.
- `courses`: add `faculty`, `semester`, `academic_level` (nullable, backfilled from existing `level` if present). Existing rows keep working.
- `pinned_courses` (user_id, course_id, pinned_at) — replaces/augments existing `course_bookmarks` semantically; bookmarks kept.
- `user_extra_courses` (user_id, course_id, kind: 'carryover'|'elective'|'extra').
- `badges` (code, name, description, icon, criteria jsonb) + `user_badges` (user_id, badge_id, earned_at).
- `xp_events` (user_id, course_id nullable, kind, amount, created_at) — append-only ledger; drives leaderboards.
- `exam_attempts`: already stores `question_ids`, `answers`, `expires_at` → reuse for resume. Add `current_index` (int, default 0) and `last_activity_at`.

RLS: user-scoped select/insert on own rows; leaderboards read via SECURITY DEFINER RPCs that return aggregated public fields only (username, avatar, xp).

Helper functions:
- `award_xp(_user, _kind, _amount, _course)` — inserts xp_event + bumps `profiles.xp`.
- `readme_level(xp)` — pure fn, e.g. `floor(sqrt(xp/50)) + 1`.
- `leaderboard_*` RPCs (global/school/dept/level/course × weekly/monthly/all-time).

Auto-generate usernames from email for existing users; store lowercased.

## Batch B — Profile split + Navigation + Settings

- `/profile` becomes **public read-only** GitHub/Discord-style card: avatar, display name, @username, ReadMe level + XP bar, streak, school/faculty/dept/level, stats (exams completed, avg, high, questions answered, streak), badges grid, "Leaderboard positions" mini-card.
- New `/settings` with sections: Account (name, username with live availability check, email, change password), Academic (school/faculty/dept/level/matric via existing `SchoolDepartmentPicker` extended for faculty), Dashboard (pin/unpin, add carryover/elective, reset), Preferences (placeholders: dark mode, notifications, privacy — disabled toggles).
- Nav: replace "Profile" link in `SiteHeader` with avatar + display name dropdown (View Profile / Settings / Dashboard / Logout). Mobile drawer mirrors it.

## Batch C — Dashboard redesign + Resume + Faster exams

- Dashboard sections: **Continue Last Exam** (from `exam_attempts` where `submitted_at is null` and not expired), **My Courses** (auto-filtered by school+dept+level + pinned + extras), **Recommended** (same school/dept, other levels/semesters not pinned), **Today's Progress** (XP today, streak, ReadMe level with progress bar, leaderboard rank), **Weakest Subject** (lowest avg score course from attempts).
- Admin course create/edit form: add faculty, semester, academic_level, first-digit validation warning (non-blocking).
- Exam UX (`practice.$courseId` / `exam.$attemptId`): auto-save on select → 400ms fade → auto-advance. Persist `answers` + `current_index` on every change via existing server fn. Last question shows **Finish Exam**. Prev + navigator preserved. Refresh restores state from server.

## Batch D — XP, Levels, Badges, Leaderboards

- Wire `award_xp` into submit-attempt flow: +2 per correct, +5 complete, +5 ≥80%, +10 =100%, +10 weekly streak (once per ISO week).
- ReadMe Level component with XP-to-next progress.
- Badges: framework + seed 4 active (First Mock, Perfect Score, 7-Day Streak, 50 Exams). Evaluator runs in submit-attempt server fn.
- `/leaderboards` page with tabs: scope (Global/School/Faculty/Dept/Level/Course) × window (Weekly/Monthly/All-Time). Course page also embeds its own top-10.

---

## Out of scope (explicitly)
- AI tutor / new AI features.
- Any removal or redesign of admin, tournaments, chat, notes, donations, question bank.
- Branding changes.

## Technical notes
- All migrations additive; nullable new columns with defaults; existing rows untouched.
- New server fns in `src/lib/{profile,settings,dashboard,xp,badges,leaderboard}.functions.ts` behind `requireSupabaseAuth`.
- Leaderboard RPCs `SECURITY DEFINER` + `GRANT EXECUTE TO authenticated` only.
- Reuse existing UI primitives (`Card`, `Button`, `Tabs`, `SchoolDepartmentPicker`) — no new design language.

---

**Reply "go" to start with Batch A (migration), or tell me which batch to prioritize / skip.**
