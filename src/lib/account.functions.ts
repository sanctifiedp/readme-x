import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, username, full_name, avatar_url, matric_no, school, faculty, department, level, xp, streak_count, created_at")
      .eq("id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return profile;
  });

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export const checkUsernameAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ username: z.string().trim() }).parse(input))
  .handler(async ({ data, context }) => {
    const uname = data.username.trim();
    if (!USERNAME_RE.test(uname)) return { available: false, reason: "Must be 3–20 letters, numbers, or underscores." };
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", uname)
      .limit(1);
    if (error) throw new Error(error.message);
    const taken = (rows ?? []).some((r) => r.id !== context.userId);
    return { available: !taken, reason: taken ? "That username is taken." : undefined };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        full_name: z.string().trim().min(1).max(120),
        username: z.string().trim().regex(USERNAME_RE, "3–20 letters, numbers or underscores").optional(),
        avatar_url: z.string().trim().url().max(500).optional().or(z.literal("")),
        matric_no: z.string().trim().max(60).optional().default(""),
        school: z.string().trim().max(120).optional().default(""),
        faculty: z.string().trim().max(120).optional().default(""),
        department: z.string().trim().max(120).optional().default(""),
        level: z.string().trim().max(20).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.username) {
      const { data: rows, error: e1 } = await supabaseAdmin
        .from("profiles").select("id").ilike("username", data.username).limit(1);
      if (e1) throw new Error(e1.message);
      if ((rows ?? []).some((r) => r.id !== context.userId)) {
        throw new Error("That username is taken.");
      }
    }
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        username: data.username || undefined,
        avatar_url: data.avatar_url ? data.avatar_url : null,
        matric_no: data.matric_no || null,
        school: data.school || null,
        faculty: data.faculty || null,
        department: data.department || null,
        level: data.level || null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPublicProfileByUsername = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ username: z.string().trim().min(1).max(40) }).parse(input))
  .handler(async ({ data }) => {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, full_name, avatar_url, school, faculty, department, level, xp, streak_count, created_at")
      .ilike("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("User not found");
    return profile;
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
