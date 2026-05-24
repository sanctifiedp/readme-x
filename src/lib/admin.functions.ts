import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        code: z.string().min(2).max(20),
        title: z.string().min(2).max(200),
        description: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("courses").insert({
      code: data.code.toUpperCase(),
      title: data.title,
      description: data.description ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const uploadMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        courseId: z.string().uuid(),
        title: z.string().min(2).max(200),
        content: z.string().min(50).max(80000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("course_materials")
      .insert({
        course_id: data.courseId,
        title: data.title,
        content: data.content,
        uploaded_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ materialId: z.string().uuid(), count: z.number().int().min(5).max(50).default(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: material, error } = await supabaseAdmin
      .from("course_materials")
      .select("id, course_id, title, content")
      .eq("id", data.materialId)
      .single();
    if (error || !material) throw new Error("Material not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI Gateway not configured");

    const systemPrompt = `You are an expert exam author. Given course material, generate ${data.count} high-quality multiple-choice questions. Each question must have exactly 4 options and one correct answer. Cover different concepts from the material. Output ONLY a JSON array, no commentary.`;

    const userPrompt = `Course: ${material.title}\n\nMaterial:\n${material.content.slice(0, 30000)}\n\nGenerate ${data.count} MCQs as JSON array of objects with shape: { "prompt": string, "options": [string, string, string, string], "correct_index": 0|1|2|3 }`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
      if (resp.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      const t = await resp.text();
      throw new Error(`AI error: ${t.slice(0, 200)}`);
    }
    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content ?? "[]";

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI returned invalid JSON");
    }
    // Accept either a direct array or { questions: [...] }
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { questions?: unknown[] })?.questions)
        ? (parsed as { questions: unknown[] }).questions
        : [];

    const schema = z.array(
      z.object({
        prompt: z.string().min(5),
        options: z.array(z.string()).length(4),
        correct_index: z.number().int().min(0).max(3),
      }),
    );
    const validated = schema.parse(arr);

    const rows = validated.map((q) => ({
      course_id: material.course_id,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correct_index,
      source_material_id: material.id,
    }));

    const { error: insErr } = await supabaseAdmin.from("questions").insert(rows);
    if (insErr) throw new Error(insErr.message);

    return { inserted: rows.length };
  });

export const adminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [{ data: courses }, { count: studentCount }, { count: attemptCount }] = await Promise.all([
      supabaseAdmin
        .from("courses")
        .select("id, code, title, description, course_materials(id, title, created_at), questions(id)")
        .order("code"),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("exam_attempts").select("id", { count: "exact", head: true }).not("submitted_at", "is", null),
    ]);

    return {
      courses:
        courses?.map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
          description: c.description,
          materials: (c.course_materials ?? []).map((m) => ({ id: m.id, title: m.title, createdAt: m.created_at })),
          questionCount: (c.questions ?? []).length,
        })) ?? [],
      studentCount: studentCount ?? 0,
      attemptCount: attemptCount ?? 0,
    };
  });

export const promoteToAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .single();
    if (error || !profile) throw new Error("User not found");
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: profile.id, role: "admin" });
    if (rErr && !rErr.message.includes("duplicate")) throw new Error(rErr.message);
    return { ok: true };
  });

import { z as _z } from "zod";
export const getChatProfileNames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    _z.object({ userIds: _z.array(_z.string().uuid()).max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.userIds.length === 0) return [] as Array<{ id: string; full_name: string | null }>;
    const { data: profs, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", data.userIds);
    if (error) throw new Error(error.message);
    return profs ?? [];
  });
