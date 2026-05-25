# ReadMe X — v2 plan

## 1. Question banks replace exams

Pivot the exam concept to **per-course question banks**.

- `questions` table already exists (`course_id`, `prompt`, `options`, `correct_index`). Add `hint TEXT NULL` for cached AI hints.
- Admin uploads questions directly to a **course** (cap **500/course**).
- Drop the `exams` editor concept; existing `exams` rows are migrated: each exam's questions are re-pointed to `exam.course_id` (already set) and the exams table is hidden from UI (kept in DB for safety).
- New browse page: list **courses** (with school/department/level filter + search). Each card → "Practice".

## 2. Practice flow (student)

On a course's Practice screen:
- Inputs: **# of questions** (1–70, capped at bank size) and **time limit** (1–30 min).
- Server function `startPractice({ courseId, count, minutes })`:
  - Randomly picks `count` question IDs from the course bank.
  - Creates an `exam_attempts` row (reuse table) with `question_ids`, `total = count`, new column `duration_seconds`, new `expires_at`.
- Take screen:
  - Countdown timer; auto-submits at 0.
  - "Show hint" button per question → calls `getHint({ questionId })`. Server checks cached `hint` column; if empty, generates a one-sentence hint via Lovable AI (`google/gemini-3-flash-preview`), stores it, returns it. Subsequent users reuse the cached hint (cheap + consistent).
- Submit → score + redirect to results.

## 3. Review on results page

Rework `results.$attemptId.tsx` to show, per question:
- The prompt
- All options with: ✓ user's answer (green if correct / red if wrong) and ✓ correct answer highlighted
- The AI hint (if it was generated during the attempt)
- Final score + time used

## 4. Fix admin editor + audit other pages

- The route `/admin/exam/$examId` exists and is correctly wired, but in the new model we rename it to `/admin/course/$courseId` and edit the **course's question bank** (the actual user complaint). The editor will:
  - Show current count `/ 500`.
  - Add question form (prompt + 4 options + correct index).
  - List + delete questions.
  - Optional: "(Re)generate hint" button per question (admin-only).
- Admin dashboard exam tab → replaced with **Courses** tab: create course (code, title, school, department, level, description), then "Edit questions" links to new editor.
- Audit pass on existing pages and fix any broken loaders/links surfaced by the pivot:
  - `take.$examId.tsx` → replaced by `practice.$courseId.tsx`.
  - `exam.$attemptId.tsx` → kept (works on attempts), updated for timer + hints.
  - Old `exams.tsx` route → redirects to new `/courses` browse.
  - Verify dashboard, donate, notes, chat still load cleanly.

## 5. Landing page refresh (light, not a redesign)

Rebuild `src/routes/index.tsx`:
1. **Hero**: H1 "Practice past questions. Pass with confidence." + 1-sentence sub ("Timed CBT practice from your course's question bank, with AI hints when you're stuck."). Primary CTA "Start practicing" (→ `/courses`), secondary "Browse notes".
2. **Benefits** (4 cards): timed practice you control · 500-question banks per course · AI hint on every question · review answers after every attempt.
3. **Trust strip**: "Built by students, for students · Early access · Your feedback shapes the roadmap."
4. **Feature preview** mock (static): screenshot-style card of a practice question + hint.
5. **Coming soon**: tagged placeholders (peer study rooms, smart recommendations).
6. **Feedback CTA**: button → the Google Form link.
7. **Secondary CTA** at bottom.
- Mobile: tighter spacing, full-width CTAs, single-column.
- Keep existing tokens in `src/styles.css`; small polish to type scale + spacing only.

## 6. Grok AI placeholder

In `/admin` add a small **AI Settings** section:
- Read-only note: "Hints are powered by Lovable AI."
- Disabled input "Grok API key (coming soon)" with helper text.
- No DB / secret writes — purely a placeholder so the user can see the planned slot.

## 7. Feedback button

- "Give feedback" link in `SiteHeader` (desktop) + `SiteFooter` + landing CTA → `https://docs.google.com/forms/d/e/1FAIpQLSdSYgpAaMAFZXmw0HSl38jzQ7DGoogXiR9BVrcCOxDHgyTZ9Q/viewform`. `target="_blank" rel="noreferrer"`.

---

## Technical section

**Migration**
- `ALTER TABLE questions ADD COLUMN hint TEXT;`
- `ALTER TABLE exam_attempts ADD COLUMN duration_seconds INT NOT NULL DEFAULT 1800, ADD COLUMN expires_at TIMESTAMPTZ;`
- Add trigger / server check: refuse insert into `questions` when course already has 500 rows.
- Keep `exams` + admin policies untouched (still RLS-protected) — just hidden from UI.

**New / changed files**
- `src/lib/courses.functions.ts` — listCourses (filters), createCourse, updateCourse, deleteCourse, getCourseBank, addCourseQuestion, deleteCourseQuestion, regenerateHint.
- `src/lib/practice.functions.ts` — startPractice, getHint (Lovable AI, on-demand, cached), submit (reuse existing logic).
- `src/routes/courses.tsx` — public browse (filters).
- `src/routes/_authenticated/practice.$courseId.tsx` — pick count + time, start.
- `src/routes/_authenticated/admin/course.$courseId.tsx` — bank editor (replaces exam editor).
- `src/routes/_authenticated/exam.$attemptId.tsx` — add timer + hint button.
- `src/routes/_authenticated/results.$attemptId.tsx` — full review UI.
- `src/routes/index.tsx` — rewritten landing.
- `SiteHeader.tsx` / `SiteFooter.tsx` — feedback link, nav updated to `/courses` + `/notes`.
- `src/routes/exams.tsx` → redirect to `/courses` (kept for backward compat).

**AI hint call** (server fn, on-demand, cached in `questions.hint`):
```
POST https://ai.gateway.lovable.dev/v1/chat/completions
model: google/gemini-3-flash-preview
system: "Give a single short sentence hint (max 20 words) that nudges the student toward the answer without revealing it."
user: prompt + options
```
Handles 429/402 with toast on the client.

**Admin editor bug**: in the new model we ship the new route `/admin/course/$courseId` and update the admin link, so the broken flow is replaced wholesale rather than patched. I'll smoke-test create-course → add-questions → start-practice → submit → review.
