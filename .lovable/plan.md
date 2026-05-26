# Plan — Rebrand + 3 Batches

## 0. Branding: "ReadMe X" → "ReadMe"
Sweep all UI strings (headers, footers, titles, `<head>` meta, hero copy, dashboard greetings, auth pages, etc.) across 13 files identified. No logic changes — pure copy edit.

## 0b. Super admin guarantee
Confirm `adeyigbeminiyi414@gmail.com` has both `admin` + `super_admin` rows in `user_roles` (the `handle_new_user` trigger already grants them on signup; we'll also run a one-off upsert to cover the case where the account already exists).

---

## 🔴 BATCH 1 — Tournaments, Auto-Winners, Donation Gating

### Schema (one migration)
- `tournaments` — title, description, target_school, target_department, target_level, prize_amount, min_participants, min_donation_pool, registration_open (bool), status (`upcoming`|`active`|`completed`|`cancelled`), course_id (question pool), question_count, duration_seconds, starts_at, ends_at, created_by, winner_user_id, winner_decided_at.
- `tournament_registrations` — tournament_id, user_id (unique pair). RLS: user inserts own row only if their profile (school/dept/level) matches the tournament; SELECT for participants + admins.
- `tournament_attempts` — tournament_id, user_id (unique pair), question_ids jsonb, score, wrong_count, duration_used_seconds, started_at, submitted_at, expires_at. One attempt per user.
- `tournament_winners` (all-time list) — tournament_id, user_id, prize_amount, payout_status (`pending_form`|`pending_approval`|`paid`), payout_details jsonb, decided_at, approved_by, approved_at. Public-safe view (name + course + prize + date).
- Add `bank_name`, `account_number`, `account_name`, `phone` payout columns or store inside `payout_details` jsonb.

### Server functions (`src/lib/tournaments.functions.ts`)
- `listTournaments({ filter })`, `getTournament({ id })` — public.
- `createTournament` / `updateTournament` / `setRegistrationOpen` / `setStatus` — admin-gated.
- `registerForTournament({ id })` — checks profile match, registration open, status=upcoming|active.
- `startTournamentAttempt({ id })` — eligibility + min-donation-pool check (sum of approved donations minus already-paid prizes ≥ tournament.prize_amount) + min-participants check; picks random questions from course bank, writes attempt with `expires_at`.
- `submitTournamentAttempt({ attemptId, answers })` — scores, sets submitted_at, wrong_count, duration_used.
- `finalizeTournament({ id })` — admin trigger OR auto-call when `ends_at` passes: rank attempts by (score desc, duration_used asc, wrong_count asc, submitted_at asc), write `tournament_winners` row with `payout_status='pending_form'`, set tournament `status='completed'`, `winner_user_id`. No-op if zero valid attempts or below min participants.
- `submitPayoutForm({ tournamentId, details })` — winner only.
- `approvePayout({ winnerId })` — admin; marks `paid`.
- `listAllTimeWinners()` — public.

### Routes
- `/tournaments` — public list (filter by school/dept/level/status).
- `/tournaments/$id` — detail page (eligibility badge, prize, status, register / start button, leaderboard after completion).
- `/_authenticated/tournament/$attemptId` — exam UI (reuse exam.$attemptId pattern with timer + auto-submit).
- `/_authenticated/admin/tournaments` — admin CRUD + finalize button + payout approvals.
- Add donation-funded note component used on tournament pages and donate page.

### Donation gating
Server-side helper `getDonationPool()` = sum(approved donations) − sum(paid prizes). Used in `startTournamentAttempt` (block if pool < prize) and shown on tournament detail.

---

## 🟠 BATCH 2 — Profile, School Control, Auth

### Schema
- `schools`, `departments` (school_id), `levels` (school_id or global) — managed by super_admin only. RLS: public SELECT, super_admin ALL.
- `profiles` add: `avatar_url`, `profile_edit_count_this_year int default 0`, `profile_edit_year int`, ensure school/dept/level are FKs to controlled tables (or text validated against them server-side to avoid breaking existing rows — go with server-side validation against the lookup tables to keep it simple).
- Avatar storage bucket `avatars` (public read, user writes own folder).

### Server fns
- `listSchools/Departments/Levels` (public).
- Super-admin CRUD for each.
- `updateProfile` — server enforces ≤2 edits/year (resets when year changes); only allows values present in lookup tables.
- `getProfile` — includes exam history (existing `exam_attempts` joined to courses) + bookmarked courses (Batch 3).

### Routes
- `/_authenticated/profile` — view/edit profile with avatar upload, edit counter.
- `/_authenticated/admin/schools` — super-admin only: manage schools/departments/levels.

### Auth
- `/forgot-password` page → `supabase.auth.resetPasswordForEmail` with `redirectTo: origin + '/reset-password'`.
- `/reset-password` page → `supabase.auth.updateUser({ password })`.
- `/_authenticated/profile` → "Change password" section using `updateUser`.
- Use existing Supabase default auth emails (no custom email infra needed unless requested).

---

## 🟡 BATCH 3 — Bookmarks, Friends, Notifications

### Schema
- `course_bookmarks` (user_id, course_id, unique).
- `friendships` (requester_id, addressee_id, status `pending|accepted|blocked`, unique pair).
- `challenges` (from_user, to_user(s) jsonb, course_id, question_count, duration_seconds, status `pending|active|completed|declined`, expires_at). Per-participant attempts reuse `exam_attempts` with a `challenge_id` column added.
- `announcements` (title, body, audience `all|school|department|level`, target filters jsonb, created_by, created_at).
- `announcement_reads` (user_id, announcement_id) for unread badge.

### Server fns
- `toggleBookmark`, `listBookmarks`.
- `searchUsers(q)` (returns name + school/dept/level, no email), `sendFriendRequest`, `respondToFriendRequest`, `listFriends`, `listFriendRequests`.
- `createChallenge`, `listMyChallenges`, `acceptChallenge` (starts attempt).
- `createAnnouncement` (admin), `listAnnouncements` (filtered by user's profile), `markAnnouncementRead`.

### Routes
- `/_authenticated/profile` → "Saved courses" tab.
- `/_authenticated/friends` — search, requests, list, "Challenge" button.
- `/_authenticated/challenges` — incoming + active.
- `/_authenticated/admin/announcements` — composer.
- Bell icon in `SiteHeader` → dropdown of announcements with unread badge.
- Add star button on `/courses` and `/practice/$courseId`.

---

## Technical notes
- Stack: existing TanStack Start + `createServerFn` + Supabase RLS pattern.
- All admin/super-admin checks via existing `has_role(uid, role)`.
- Auto-finalize tournaments lazily: when anyone visits the tournament page after `ends_at`, call `finalizeTournament` server-side if not yet finalized (avoids needing pg_cron).
- Migrations split per batch to keep approvals reviewable.

## Delivery order
1. Rebrand sweep + super-admin upsert (small).
2. Batch 1 migration → approve → code.
3. Batch 2 migration → approve → code.
4. Batch 3 migration → approve → code.

Confirm to proceed, or tell me which batch to drop/reorder.
