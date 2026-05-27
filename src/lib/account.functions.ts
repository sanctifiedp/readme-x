import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, matric_no, school, department, level, created_at")
      .eq("id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return profile;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        full_name: z.string().trim().min(1).max(120),
        matric_no: z.string().trim().max(60).optional().default(""),
        school: z.string().trim().max(120).optional().default(""),
        department: z.string().trim().max(120).optional().default(""),
        level: z.string().trim().max(20).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        matric_no: data.matric_no || null,
        school: data.school || null,
        department: data.department || null,
        level: data.level || null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ confirm: z.literal("DELETE") }).parse(input),
  )
  .handler(async ({ context }) => {
    const uid = context.userId;
    // Best-effort cleanup of user-owned rows (RLS bypassed via service role).
    await Promise.all([
      supabaseAdmin.from("attempt_answers").delete().in(
        "attempt_id",
        (await supabaseAdmin.from("exam_attempts").select("id").eq("user_id", uid)).data?.map((r) => r.id) ?? [],
      ),
      supabaseAdmin.from("exam_attempts").delete().eq("user_id", uid),
      supabaseAdmin.from("tournament_attempts").delete().eq("user_id", uid),
      supabaseAdmin.from("tournament_registrations").delete().eq("user_id", uid),
      supabaseAdmin.from("tournament_winners").delete().eq("user_id", uid),
      supabaseAdmin.from("course_bookmarks").delete().eq("user_id", uid),
      supabaseAdmin.from("chat_messages").delete().eq("user_id", uid),
      supabaseAdmin.from("donations").delete().eq("user_id", uid),
      supabaseAdmin.from("user_roles").delete().eq("user_id", uid),
      supabaseAdmin.from("profiles").delete().eq("id", uid),
    ]);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleBookmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ courseId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await supabaseAdmin
      .from("course_bookmarks")
      .select("id")
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("course_bookmarks").delete().eq("id", existing.id);
      return { bookmarked: false };
    }
    const { error } = await supabaseAdmin
      .from("course_bookmarks")
      .insert({ user_id: context.userId, course_id: data.courseId });
    if (error) throw new Error(error.message);
    return { bookmarked: true };
  });

export const listMyBookmarkIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("course_bookmarks")
      .select("course_id")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.course_id);
  });

export const listMyBookmarks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("course_bookmarks")
      .select("course_id, created_at, courses(id, code, title, school, department, level)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map((r) => r.courses)
      .filter((c): c is NonNullable<typeof c> => !!c);
  });
