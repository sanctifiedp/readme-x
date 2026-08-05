import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type CourseRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  school: string | null;
  department: string | null;
  level: string | null;
};

function readmeLevel(xp: number) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(xp, 0) / 50)) + 1);
}
function xpForLevel(level: number) {
  return 50 * Math.pow(Math.max(1, level) - 1, 2);
}


export const getPersonalizedDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;

    const [profileRes, rolesRes, pinnedRes, extraRes, unfinishedRes, attemptsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, username, avatar_url, matric_no, email, school, faculty, department, level, xp, streak_count, streak_last_day")
        .eq("id", uid)
        .single(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", uid),
      supabaseAdmin
        .from("pinned_courses")
        .select("course_id, pinned_at, courses(id, code, title, description, school, department, level)")
        .eq("user_id", uid)
        .order("pinned_at", { ascending: false }),
      supabaseAdmin
        .from("user_extra_courses")
        .select("course_id, kind, courses(id, code, title, description, school, department, level)")
        .eq("user_id", uid),
      supabaseAdmin
        .from("exam_attempts")
        .select("id, course_id, total, current_index, expires_at, started_at, last_activity_at, courses(code, title)")
        .eq("user_id", uid)
        .is("submitted_at", null)
        .order("last_activity_at", { ascending: false })
        .limit(1),
      supabaseAdmin
        .from("exam_attempts")
        .select("id, course_id, score, total, submitted_at, started_at, courses(code, title)")
        .eq("user_id", uid)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(50),
    ]);

    const profile = profileRes.data;
    if (!profile) throw new Error("Profile not found");

    const isAdmin = (rolesRes.data ?? []).some((r) => r.role === "admin" || r.role === "super_admin");

    // Recommended: courses matching user's school/department/level, excluding pinned/extra
    const pinnedIds = new Set((pinnedRes.data ?? []).map((r) => r.course_id));
    const extraIds = new Set((extraRes.data ?? []).map((r) => r.course_id));
    const excluded = new Set([...pinnedIds, ...extraIds]);

    // Recommended: primarily school + level (department codes vary widely and
    // over-filtering here was returning nothing). Department matches float to top.
    const levelDigits = (profile.level ?? "").match(/\d+/)?.[0] ?? "";
    const buildRec = (opts: { school: boolean; level: boolean }) => {
      let q = supabaseAdmin
        .from("courses")
        .select("id, code, title, description, school, department, level")
        .limit(48);
      if (opts.school && profile.school) q = q.ilike("school", `%${profile.school.trim()}%`);
      if (opts.level && levelDigits) q = q.ilike("level", `%${levelDigits}%`);
      return q;
    };

    let { data: recData } = await buildRec({ school: true, level: true });
    if (!recData || recData.length === 0) {
      ({ data: recData } = await buildRec({ school: true, level: false }));
    }
    if (!recData || recData.length === 0) {
      ({ data: recData } = await buildRec({ school: false, level: false }));
    }

    const dept = (profile.department ?? "").trim().toLowerCase();
    const recommended = (recData ?? [])
      .filter((c) => !excluded.has(c.id))
      .sort((a, b) => {
        const score = (c: { department: string | null }) =>
          dept && (c.department ?? "").trim().toLowerCase() === dept ? 0 : 1;
        return score(a) - score(b);
      })
      .slice(0, 12) as CourseRow[];


    // Today's XP + rank (all-time, global)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data: todayXpRows } = await supabaseAdmin
      .from("xp_events")
      .select("amount")
      .eq("user_id", uid)
      .gte("created_at", todayStart.toISOString());
    const todayXp = (todayXpRows ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

    // Global rank placeholder: count profiles with higher xp
    const { count: higher } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gt("xp", profile.xp ?? 0);
    const rank = (higher ?? 0) + 1;

    // Per-course averages for weakest/strongest subjects
    const perCourse = new Map<string, { id: string; code: string; title: string; sum: number; count: number }>();
    for (const a of attemptsRes.data ?? []) {
      if (!a.course_id || !a.total || a.score == null) continue;
      const key = a.course_id;
      const existing = perCourse.get(key) ?? { id: a.course_id, code: a.courses?.code ?? "", title: a.courses?.title ?? "", sum: 0, count: 0 };
      existing.sum += (a.score / a.total) * 100;
      existing.count += 1;
      perCourse.set(key, existing);
    }
    let weakest: { id: string; code: string; title: string; average: number } | null = null;
    let strongest: { id: string; code: string; title: string; average: number } | null = null;
    for (const v of perCourse.values()) {
      if (v.count < 2) continue;
      const avg = v.sum / v.count;
      if (!weakest || avg < weakest.average) weakest = { id: v.id, code: v.code, title: v.title, average: Math.round(avg) };
      if (!strongest || avg > strongest.average) strongest = { id: v.id, code: v.code, title: v.title, average: Math.round(avg) };
    }

    // Recent performance: last finished attempt, trend vs prior
    const finished = attemptsRes.data ?? [];
    const last = finished[0];
    const prior = finished[1];
    const pct = (s: number | null | undefined, t: number | null | undefined) =>
      s == null || !t ? null : Math.round((s / t) * 100);
    const recent = last
      ? {
          code: last.courses?.code ?? "",
          title: last.courses?.title ?? "",
          score: last.score ?? 0,
          total: last.total ?? 0,
          accuracy: pct(last.score, last.total) ?? 0,
          delta:
            prior && pct(last.score, last.total) != null && pct(prior.score, prior.total) != null
              ? (pct(last.score, last.total) as number) - (pct(prior.score, prior.total) as number)
              : null,
          submittedAt: last.submitted_at,
        }
      : null;
    const totalAttempts = finished.length;
    const totalQuestions = finished.reduce((s, a) => s + (a.total ?? 0), 0);

    const unfinishedRaw = unfinishedRes.data?.[0];
    const now = Date.now();
    const unfinished =
      unfinishedRaw && (!unfinishedRaw.expires_at || new Date(unfinishedRaw.expires_at).getTime() > now)
        ? {
            id: unfinishedRaw.id,
            courseCode: unfinishedRaw.courses?.code ?? "",
            courseTitle: unfinishedRaw.courses?.title ?? "Practice",
            currentIndex: unfinishedRaw.current_index ?? 0,
            total: unfinishedRaw.total,
            expiresAt: unfinishedRaw.expires_at,
            lastActivityAt: unfinishedRaw.last_activity_at,
          }
        : null;

    const mapCourse = (c: CourseRow) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      description: c.description,
      school: c.school,
      department: c.department,
      level: c.level,
    });

    return {
      profile: {
        id: profile.id,
        fullName: profile.full_name,
        username: profile.username,
        avatarUrl: await (await import("@/lib/avatar.server")).resolveAvatarUrl(profile.avatar_url),
        matricNo: profile.matric_no,
        email: profile.email,
        school: profile.school,
        faculty: profile.faculty,
        department: profile.department,
        level: profile.level,
        xp: profile.xp ?? 0,
        streak: profile.streak_count ?? 0,
        readmeLevel: readmeLevel(profile.xp ?? 0),
        levelBaseXp: xpForLevel(readmeLevel(profile.xp ?? 0)),
        nextLevelXp: xpForLevel(readmeLevel(profile.xp ?? 0) + 1),
      },

      isAdmin,
      unfinished,
      pinned: (pinnedRes.data ?? [])
        .map((r) => r.courses)
        .filter((c): c is CourseRow => !!c)
        .map(mapCourse),
      extra: (extraRes.data ?? [])
        .map((r) => (r.courses ? { ...r.courses, kind: r.kind } : null))
        .filter((c): c is CourseRow & { kind: string } => !!c)
        .map((c) => ({ ...mapCourse(c), kind: c.kind })),
      recommended: recommended.map(mapCourse),
      todayXp,
      rank,
      weakest,
      strongest,
      recent,
      totalAttempts,
      totalQuestions,
    };
  });

export const pinCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await supabaseAdmin
      .from("pinned_courses")
      .select("id")
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId)
      .maybeSingle();
    if (existing) return { ok: true };
    const { error } = await supabaseAdmin
      .from("pinned_courses")
      .insert({ user_id: context.userId, course_id: data.courseId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unpinCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("pinned_courses")
      .delete()
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addExtraCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      courseId: z.string().uuid(),
      kind: z.enum(["carryover", "elective", "cross_level", "other"]).optional().default("other"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await supabaseAdmin
      .from("user_extra_courses")
      .select("id")
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId)
      .maybeSingle();
    if (existing) return { ok: true };
    const { error } = await supabaseAdmin
      .from("user_extra_courses")
      .insert({ user_id: context.userId, course_id: data.courseId, kind: data.kind });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeExtraCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("user_extra_courses")
      .delete()
      .eq("user_id", context.userId)
      .eq("course_id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const searchCoursesForAdd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ q: z.string().trim().max(80).optional().default("") }).parse(input))
  .handler(async ({ data }) => {
    const term = data.q.replace(/[%_]/g, "").trim();
    let q = supabaseAdmin
      .from("courses")
      .select("id, code, title, school, department, level")
      .order("code")
      .limit(20);
    if (term) q = q.or(`code.ilike.%${term}%,title.ilike.%${term}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
