import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_QUESTIONS_PER_EXAM = 90;

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

// Public listing with search filters
export const listExams = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      q: z.string().trim().max(120).optional(),
      school: z.string().trim().max(120).optional(),
      department: z.string().trim().max(120).optional(),
      level: z.string().trim().max(20).optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("exams")
      .select("id, title, description, school, department, level, course_id, created_at, questions(id)")
      .order("created_at", { ascending: false });
    if (data.school) q = q.ilike("school", `%${data.school}%`);
    if (data.department) q = q.ilike("department", `%${data.department}%`);
    if (data.level) q = q.ilike("level", `%${data.level}%`);
    if (data.q) q = q.or(`title.ilike.%${data.q}%,description.ilike.%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      school: e.school,
      department: e.department,
      level: e.level,
      questionCount: (e.questions ?? []).length,
      createdAt: e.created_at,
    }));
  });

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      title: z.string().trim().min(2).max(200),
      description: z.string().trim().max(2000).optional(),
      school: z.string().trim().max(120).optional(),
      department: z.string().trim().max(120).optional(),
      level: z.string().trim().max(20).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin.from("exams").insert({
      title: data.title,
      description: data.description ?? null,
      school: data.school ?? null,
      department: data.department ?? null,
      level: data.level ?? null,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getExamForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: exam, error } = await supabaseAdmin
      .from("exams").select("*").eq("id", data.examId).single();
    if (error || !exam) throw new Error("Exam not found");
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, prompt, options, correct_index, created_at")
      .eq("exam_id", data.examId)
      .order("created_at");
    return { exam, questions: questions ?? [], max: MAX_QUESTIONS_PER_EXAM };
  });

export const addExamQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      examId: z.string().uuid(),
      prompt: z.string().trim().min(3).max(2000),
      options: z.array(z.string().trim().min(1).max(500)).length(4),
      correctIndex: z.number().int().min(0).max(3),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { count } = await supabaseAdmin
      .from("questions").select("id", { count: "exact", head: true }).eq("exam_id", data.examId);
    if ((count ?? 0) >= MAX_QUESTIONS_PER_EXAM) {
      throw new Error(`This exam already has the maximum of ${MAX_QUESTIONS_PER_EXAM} questions.`);
    }
    const { data: exam } = await supabaseAdmin.from("exams").select("course_id").eq("id", data.examId).single();
    const { error } = await supabaseAdmin.from("questions").insert({
      exam_id: data.examId,
      course_id: exam?.course_id ?? null,
      prompt: data.prompt,
      options: data.options,
      correct_index: data.correctIndex,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExamQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("exams").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Student takes an exam — picks all questions (up to MAX) randomized.
export const startExamAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: questions, error } = await supabaseAdmin
      .from("questions").select("id").eq("exam_id", data.examId);
    if (error) throw new Error(error.message);
    if (!questions || questions.length === 0) throw new Error("This exam has no questions yet.");
    const shuffled = [...questions].sort(() => Math.random() - 0.5).map((q) => q.id);

    const { data: exam } = await supabaseAdmin.from("exams").select("course_id").eq("id", data.examId).single();

    const { data: attempt, error: aErr } = await supabaseAdmin.from("exam_attempts").insert({
      user_id: context.userId,
      exam_id: data.examId,
      course_id: exam?.course_id ?? null,
      question_ids: shuffled,
      total: shuffled.length,
    }).select("id").single();
    if (aErr) throw new Error(aErr.message);
    return { attemptId: attempt.id };
  });
