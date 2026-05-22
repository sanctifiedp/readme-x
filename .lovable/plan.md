## ReadMe — CBT Exam Platform (clone of PRESIDO-CBT, rebranded)

Rebuilding from scratch since the original project isn't in your workspace. New name: **ReadMe**. New brand: **blue** palette (replacing green).

### Tech foundation

- TanStack Start + Tailwind v4 (current template)
- Lovable Cloud (Postgres + Auth + Storage) — needed for users, exams, chat, materials
- Lovable AI Gateway — for AI question generation from course materials

### Pages / routes

- `/` — landing (hero, features grid, rotating quotes, theme toggle, donate + contact admin)
- `/auth` — sign up / sign in (email + password)
- `/dashboard` — student home: list courses, recent attempts, daily quote
- `/courses/$code` — course page: start exam, view past attempts, materials
- `/exam/$attemptId` — 30-question randomized test, timer, submit
- `/results/$attemptId` — auto-graded score + per-question review
- `/chat` — realtime class group chat
- `/admin` — admin only: upload materials per course, manage question banks, view students
- `_authenticated/` layout protecting everything except `/` and `/auth`

### Data model (Lovable Cloud)

- `profiles` (id, full_name, matric_no)
- `user_roles` (user_id, role: admin | student) — separate table, with `has_role()` SECURITY DEFINER
- `courses` (id, code, title)
- `course_materials` (id, course_id, file_path, uploaded_by)
- `questions` (id, course_id, prompt, options jsonb, correct_index, source_material_id)
- `exam_attempts` (id, user_id, course_id, started_at, submitted_at, score)
- `attempt_answers` (attempt_id, question_id, chosen_index, is_correct)
- `chat_messages` (id, user_id, body, created_at) — realtime
- `quotes` (id, text, author) — seeded list

RLS on every table. Students read/write their own attempts; admins manage courses, materials, questions; chat readable by all authenticated users.

### Server functions / routes

- `generateQuestions(courseId, materialId)` — admin-only, calls AI Gateway to produce N MCQs from uploaded material text, inserts into `questions`
- `startAttempt(courseId)` — picks 30 random questions, creates attempt
- `submitAttempt(attemptId, answers)` — grades, stores score
- `getDailyQuote()` — random quote

### Branding: ReadMe (blue)

- Primary blue palette in `src/styles.css` (oklch), light + dark
- Logo wordmark "ReadMe" with book icon
- Updated meta titles/descriptions on every route

### Build flow

1. Enable Lovable Cloud + AI Gateway
2. Generate 3 design directions for the landing page (blue, exam-platform energy) and let you pick one
3. Migrations for schema + RLS + seed quotes
4. Auth flow + protected layout + roles
5. Landing + dashboard + course + exam + results pages
6. Realtime chat
7. Admin panel: material upload + AI question generation
8. Polish, SEO meta per route, theme toggle

### Notes

- I can't copy the original's exact question bank or course list — those live in the original project's database. You'll seed your own courses + upload materials via the admin panel; AI generates the questions.
- Donate button and admin phone number: tell me what to point them at (or I'll leave them as placeholders you can edit). Donation can go to Adeyi Gbeminiyi, account number 9064887865, bank Opay. Contact 09064887865, adeyigbeminiyi414@gmail.com