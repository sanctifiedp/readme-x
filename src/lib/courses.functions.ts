import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizePostgrestTerm } from "./search-sanitize";

const MAX_PER_COURSE = 500;

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]).limit(1).maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

// Public browse with filters + question counts
export const listCoursesPublic = createServerFn({ method: "POST" })
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
      .from("courses")
      .select("id, code, title, description, school, department, level, questions(id)")
      .order("code");
    if (data.school) q = q.ilike("school", `%${data.school}%`);
    if (data.department) q = q.ilike("department", `%${data.department}%`);
    if (data.level) q = q.ilike("level", `%${data.level}%`);
    if (data.q) {
      const s = sanitizePostgrestTerm(data.q);
      if (s) q = q.or(`title.ilike.%${s}%,code.ilike.%${s}%,description.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      description: c.description,
      school: c.school,
      department: c.department,
      level: c.level,
      questionCount: (c.questions ?? []).length,
    }));
  });

export const getCoursePublic = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: c, error } = await supabaseAdmin
      .from("courses")
      .select("id, code, title, description, school, department, level, questions(id)")
      .eq("id", data.courseId)
      .single();
    if (error || !c) throw new Error("Course not found");
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      description: c.description,
      school: c.school,
      department: c.department,
      level: c.level,
      questionCount: (c.questions ?? []).length,
    };
  });

export const createCourseFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      code: z.string().trim().min(2).max(20),
      title: z.string().trim().min(2).max(200),
      description: z.string().trim().max(1000).optional(),
      school: z.string().trim().max(120).optional(),
      department: z.string().trim().max(120).optional(),
      level: z.string().trim().max(20).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin.from("courses").insert({
      code: data.code.toUpperCase(),
      title: data.title,
      description: data.description ?? null,
      school: data.school ?? null,
      department: data.department ?? null,
      level: data.level ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("questions").delete().eq("course_id", data.id);
    const { error } = await supabaseAdmin.from("courses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCourseBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { resolveQuestionImageUrls } = await import("./question-media.server");
    const { data: course, error } = await supabaseAdmin
      .from("courses").select("id, code, title, school, department, level").eq("id", data.courseId).single();
    if (error || !course) throw new Error("Course not found");
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, prompt, options, correct_index, hint, explanation, image_path, question_type, created_at")
      .eq("course_id", data.courseId)
      .order("created_at");
    const rows = questions ?? [];
    const urls = await resolveQuestionImageUrls(rows.map((q) => q.image_path));
    return {
      course,
      questions: rows.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: (q.options as string[]) ?? [],
        correct_index: q.correct_index,
        hint: q.hint,
        explanation: q.explanation ?? null,
        questionType: q.question_type ?? "mcq_single",
        imageUrl: q.image_path ? urls[q.image_path] ?? null : null,
        hasImage: !!q.image_path,
        created_at: q.created_at,
      })),
      max: MAX_PER_COURSE,
    };
  });

const questionDraftSchema = z.object({
  courseId: z.string().uuid(),
  prompt: z.string().trim().min(3).max(4000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  explanation: z.string().trim().max(2000).optional().nullable(),
  questionType: z.enum(["mcq_single"]).default("mcq_single"),
  /** New upload as a base64 data URL, "" / null to keep, "remove" handled separately. */
  imageDataUrl: z.string().max(8_000_000).optional().nullable(),
});

function assertDraft(d: { options: string[]; correctIndex: number }) {
  if (d.correctIndex >= d.options.length) throw new Error("Select a correct answer.");
  const seen = new Set<string>();
  for (const o of d.options) {
    const key = o.trim().toLowerCase();
    if (seen.has(key)) throw new Error("Options must be unique.");
    seen.add(key);
  }
}

/**
 * Duplicate scan restricted to the same course bank. Similarity is computed with a
 * local scorer (see question-similarity.ts) so this stays cheap as banks grow.
 */
export const checkQuestionDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      courseId: z.string().uuid(),
      prompt: z.string().trim().min(1).max(4000),
      options: z.array(z.string()).min(1).max(6),
      correctIndex: z.number().int().min(0).max(5),
      hasImage: z.boolean().default(false),
      excludeId: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { compareQuestions, SIMILARITY_THRESHOLD } = await import("./question-similarity");
    const { resolveQuestionImageUrls } = await import("./question-media.server");

    const { data: existing } = await supabaseAdmin
      .from("questions")
      .select("id, prompt, options, correct_index, explanation, image_path")
      .eq("course_id", data.courseId);

    const candidate = {
      prompt: data.prompt,
      options: data.options,
      correctIndex: data.correctIndex,
      hasImage: data.hasImage,
    };

    const scored = (existing ?? [])
      .filter((q) => q.id !== data.excludeId)
      .map((q) => ({
        q,
        cmp: compareQuestions(candidate, {
          prompt: q.prompt,
          options: (q.options as string[]) ?? [],
          correctIndex: q.correct_index,
          hasImage: !!q.image_path,
        }),
      }))
      .filter((r) => r.cmp.score >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.cmp.score - a.cmp.score)
      .slice(0, 3);

    const urls = await resolveQuestionImageUrls(scored.map((s) => s.q.image_path));

    return {
      threshold: SIMILARITY_THRESHOLD,
      matches: scored.map((s) => ({
        id: s.q.id,
        prompt: s.q.prompt,
        options: (s.q.options as string[]) ?? [],
        correctIndex: s.q.correct_index,
        explanation: s.q.explanation ?? null,
        imageUrl: s.q.image_path ? urls[s.q.image_path] ?? null : null,
        similarity: Math.round(s.cmp.score * 100),
        promptSimilarity: Math.round(s.cmp.promptScore * 100),
        optionsSimilarity: Math.round(s.cmp.optionsScore * 100),
        sameCorrectAnswer: s.cmp.sameCorrectAnswer,
      })),
    };
  });

export const addCourseQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    questionDraftSchema.extend({
      /** When set, this existing question is replaced (admin-confirmed) instead of adding a new one. */
      replaceQuestionId: z.string().uuid().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    assertDraft(data);
    const { uploadQuestionImage, deleteQuestionImage } = await import("./question-media.server");

    const imagePath = data.imageDataUrl
      ? await uploadQuestionImage(data.courseId, data.imageDataUrl)
      : null;

    const payload = {
      course_id: data.courseId,
      prompt: data.prompt,
      options: data.options,
      correct_index: data.correctIndex,
      explanation: data.explanation?.trim() ? data.explanation.trim() : null,
      question_type: data.questionType,
      image_path: imagePath,
      hint: null,
    };

    if (data.replaceQuestionId) {
      // Explicit admin confirmation only — update in place so exams keep working.
      const { data: old } = await supabaseAdmin
        .from("questions").select("image_path").eq("id", data.replaceQuestionId).single();
      const { error } = await supabaseAdmin
        .from("questions")
        .update(payload)
        .eq("id", data.replaceQuestionId)
        .eq("course_id", data.courseId);
      if (error) throw new Error(error.message);
      if (old?.image_path && old.image_path !== imagePath) await deleteQuestionImage(old.image_path);
      return { ok: true, replaced: true as const };
    }

    const { error } = await supabaseAdmin.from("questions").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true, replaced: false as const };
  });

export const updateCourseQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    questionDraftSchema.extend({
      id: z.string().uuid(),
      removeImage: z.boolean().default(false),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    assertDraft(data);
    const { uploadQuestionImage, deleteQuestionImage } = await import("./question-media.server");

    const { data: old } = await supabaseAdmin
      .from("questions").select("image_path").eq("id", data.id).single();

    let imagePath = old?.image_path ?? null;
    if (data.imageDataUrl) imagePath = await uploadQuestionImage(data.courseId, data.imageDataUrl);
    else if (data.removeImage) imagePath = null;

    const { error } = await supabaseAdmin
      .from("questions")
      .update({
        prompt: data.prompt,
        options: data.options,
        correct_index: data.correctIndex,
        explanation: data.explanation?.trim() ? data.explanation.trim() : null,
        question_type: data.questionType,
        image_path: imagePath,
      })
      .eq("id", data.id)
      .eq("course_id", data.courseId);
    if (error) throw new Error(error.message);
    if (old?.image_path && old.image_path !== imagePath) await deleteQuestionImage(old.image_path);
    return { ok: true };
  });

export const deleteCourseQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { deleteQuestionImage } = await import("./question-media.server");
    const { data: old } = await supabaseAdmin
      .from("questions").select("image_path").eq("id", data.id).single();
    const { error } = await supabaseAdmin.from("questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await deleteQuestionImage(old?.image_path);
    return { ok: true };
  });

