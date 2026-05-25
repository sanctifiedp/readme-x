import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_PER_COURSE = 500;

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]).maybeSingle();
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
    if (data.q) q = q.or(`title.ilike.%${data.q}%,code.ilike.%${data.q}%,description.ilike.%${data.q}%`);
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
    const { data: course, error } = await supabaseAdmin
      .from("courses").select("id, code, title, school, department, level").eq("id", data.courseId).single();
    if (error || !course) throw new Error("Course not found");
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, prompt, options, correct_index, hint, created_at")
      .eq("course_id", data.courseId)
      .order("created_at");
    return { course, questions: questions ?? [], max: MAX_PER_COURSE };
  });

export const addCourseQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      courseId: z.string().uuid(),
      prompt: z.string().trim().min(3).max(2000),
      options: z.array(z.string().trim().min(1).max(500)).length(4),
      correctIndex: z.number().int().min(0).max(3),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("questions").insert({
      course_id: data.courseId,
      prompt: data.prompt,
      options: data.options,
      correct_index: data.correctIndex,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCourseQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
