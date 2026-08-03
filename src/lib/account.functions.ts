import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 183;

function cooldown(changedAt: string | null, currentValue: string | null) {
  // First-time setup is always allowed.
  if (!currentValue || !changedAt) return { locked: false, unlocksAt: null as string | null };
  const unlocks = new Date(changedAt).getTime() + SIX_MONTHS_MS;
  return unlocks > Date.now()
    ? { locked: true, unlocksAt: new Date(unlocks).toISOString() }
    : { locked: false, unlocksAt: null };
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, username, full_name, avatar_url, matric_no, school, faculty, department, level, xp, streak_count, created_at, school_changed_at, level_changed_at")
      .eq("id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return {
      ...profile,
      schoolLock: cooldown(profile.school_changed_at, profile.school),
      levelLock: cooldown(profile.level_changed_at, profile.level),
    };
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
        matric_no: z.string().trim().max(60).optional(),
        school: z.string().trim().max(120).optional(),
        faculty: z.string().trim().max(120).optional(),
        department: z.string().trim().max(120).optional(),
        level: z.string().trim().max(20).optional(),
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

    const { data: current, error: e2 } = await supabaseAdmin
      .from("profiles")
      .select("school, level, school_changed_at, level_changed_at")
      .eq("id", context.userId)
      .single();
    if (e2) throw new Error(e2.message);

    type ProfilePatch = {
      full_name: string; username?: string; avatar_url?: string | null; matric_no?: string | null;
      faculty?: string | null; school?: string; department?: string; level?: string;
    };
    const patch: ProfilePatch = { full_name: data.full_name };
    if (data.username) patch.username = data.username;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url || null;
    if (data.matric_no !== undefined) patch.matric_no = data.matric_no || null;
    if (data.faculty !== undefined) patch.faculty = data.faculty || null;

    // School / department: both required together, and a school change re-requires a department.
    const nextSchool = data.school?.trim();
    const nextDept = data.department?.trim();
    if (nextSchool !== undefined && nextSchool !== (current.school ?? "")) {
      const lock = cooldown(current.school_changed_at, current.school);
      if (lock.locked) {
        throw new Error(
          `School changes are locked. You can change your school again on ${new Date(lock.unlocksAt!).toLocaleDateString()}.`,
        );
      }
      if (!nextSchool) throw new Error("School is required.");
      if (!nextDept) throw new Error("Select a department for your new school before saving.");
      patch.school = nextSchool;
      patch.department = nextDept;
    } else if (nextDept !== undefined) {
      if (!nextDept && (nextSchool ?? current.school)) throw new Error("Department is required.");
      if (nextDept) patch.department = nextDept;
    }

    const nextLevel = data.level?.trim();
    if (nextLevel !== undefined && nextLevel !== (current.level ?? "")) {
      const lock = cooldown(current.level_changed_at, current.level);
      if (lock.locked) {
        throw new Error(
          `Academic level changes are locked. You can change your level again on ${new Date(lock.unlocksAt!).toLocaleDateString()}.`,
        );
      }
      if (!nextLevel) throw new Error("Academic level is required.");
      patch.level = nextLevel;
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) {
      if (error.message.includes("SCHOOL_COOLDOWN")) throw new Error("School changes are locked for 6 months.");
      if (error.message.includes("LEVEL_COOLDOWN")) throw new Error("Academic level changes are locked for 6 months.");
      throw new Error(error.message);
    }
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
