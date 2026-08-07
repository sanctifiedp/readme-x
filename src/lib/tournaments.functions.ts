import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId)
    .in("role", ["admin", "super_admin"]).limit(1).maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

async function getDonationPool() {
  const [{ data: donations }, { data: paid }] = await Promise.all([
    supabaseAdmin.from("donations").select("amount").eq("status", "approved"),
    supabaseAdmin.from("tournament_winners").select("prize_amount").eq("payout_status", "paid"),
  ]);
  const donated = (donations ?? []).reduce((s, d) => s + Number(d.amount || 0), 0);
  const out = (paid ?? []).reduce((s, p) => s + Number(p.prize_amount || 0), 0);
  return { available: donated - out, donated, paid: out };
}

export const getPoolStatus = createServerFn({ method: "GET" }).handler(async () => {
  return getDonationPool();
});

const TournamentInput = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  targetSchool: z.string().trim().min(1).max(120),
  targetDepartment: z.string().trim().min(1).max(120),
  targetLevel: z.string().trim().min(1).max(20),
  prizeAmount: z.number().nonnegative().max(10_000_000),
  minParticipants: z.number().int().min(1).max(1000),
  minDonationPool: z.number().nonnegative().max(10_000_000),
  courseId: z.string().uuid(),
  questionCount: z.number().int().min(1).max(70),
  durationSeconds: z.number().int().min(60).max(1800),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  registrationOpen: z.boolean().default(true),
  status: z.enum(["upcoming", "active", "completed", "cancelled"]).default("upcoming"),
});

export const createTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => TournamentInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin.from("tournaments").insert({
      title: data.title,
      description: data.description ?? null,
      target_school: data.targetSchool,
      target_department: data.targetDepartment,
      target_level: data.targetLevel,
      prize_amount: data.prizeAmount,
      min_participants: data.minParticipants,
      min_donation_pool: data.minDonationPool,
      course_id: data.courseId,
      question_count: data.questionCount,
      duration_seconds: data.durationSeconds,
      starts_at: data.startsAt ?? null,
      ends_at: data.endsAt ?? null,
      registration_open: data.registrationOpen,
      status: data.status,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    id: z.string().uuid(),
    patch: z.object({
      registrationOpen: z.boolean().optional(),
      status: z.enum(["upcoming", "active", "completed", "cancelled"]).optional(),
      prizeAmount: z.number().nonnegative().optional(),
      startsAt: z.string().datetime().nullable().optional(),
      endsAt: z.string().datetime().nullable().optional(),
    }),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const p: {
      registration_open?: boolean;
      status?: "upcoming" | "active" | "completed" | "cancelled";
      prize_amount?: number;
      starts_at?: string | null;
      ends_at?: string | null;
    } = {};
    if (data.patch.registrationOpen !== undefined) p.registration_open = data.patch.registrationOpen;
    if (data.patch.status !== undefined) p.status = data.patch.status;
    if (data.patch.prizeAmount !== undefined) p.prize_amount = data.patch.prizeAmount;
    if (data.patch.startsAt !== undefined) p.starts_at = data.patch.startsAt;
    if (data.patch.endsAt !== undefined) p.ends_at = data.patch.endsAt;
    const { error } = await supabaseAdmin.from("tournaments").update(p).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("tournaments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTournaments = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    school: z.string().optional(),
    department: z.string().optional(),
    level: z.string().optional(),
    status: z.string().optional(),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("tournaments")
      .select("id, title, description, target_school, target_department, target_level, prize_amount, status, registration_open, starts_at, ends_at, course_id, question_count, duration_seconds, courses(code, title)")
      .order("created_at", { ascending: false });
    if (data.school) q = q.ilike("target_school", `%${data.school}%`);
    if (data.department) q = q.ilike("target_department", `%${data.department}%`);
    if (data.level) q = q.ilike("target_level", `%${data.level}%`);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getTournament = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await maybeFinalize(data.id);
    const { data: t, error } = await supabaseAdmin
      .from("tournaments")
      .select(
        "id, title, description, status, prize_amount, question_count, duration_seconds, registration_open, starts_at, ends_at, min_participants, target_school, target_department, target_level, winner_decided_at, courses(code, title)",
      )
      .eq("id", data.id).single();
    if (error || !t) throw new Error("Tournament not found");
    const [{ count: regCount }, { data: winnerRow }] = await Promise.all([
      supabaseAdmin.from("tournament_registrations").select("id", { count: "exact", head: true }).eq("tournament_id", data.id),
      supabaseAdmin.from("tournament_winners").select("id, prize_amount, payout_status, decided_at, user_id").eq("tournament_id", data.id).maybeSingle(),
    ]);
    let winner:
      | { id: string; prize_amount: number; payout_status: string; decided_at: string; winner_name: string | null }
      | null = null;
    if (winnerRow) {
      const { data: prof } = await supabaseAdmin.from("profiles").select("full_name").eq("id", winnerRow.user_id).maybeSingle();
      winner = {
        id: winnerRow.id,
        prize_amount: winnerRow.prize_amount,
        payout_status: winnerRow.payout_status,
        decided_at: winnerRow.decided_at,
        winner_name: prof?.full_name ?? null,
      };
    }
    const pool = await getDonationPool();
    return { tournament: t, registrationCount: regCount ?? 0, winner, pool };
  });

async function maybeFinalize(tournamentId: string) {
  const { data: t } = await supabaseAdmin.from("tournaments")
    .select("id, status, ends_at, prize_amount, min_participants").eq("id", tournamentId).single();
  if (!t) return;
  if (t.status === "completed" || t.status === "cancelled") return;
  if (!t.ends_at || new Date(t.ends_at).getTime() > Date.now()) return;
  await finalizeInternal(tournamentId);
}

async function finalizeInternal(tournamentId: string) {
  const { data: t } = await supabaseAdmin.from("tournaments")
    .select("id, prize_amount, min_participants, status").eq("id", tournamentId).single();
  if (!t || t.status === "completed") return;

  const { data: attempts } = await supabaseAdmin
    .from("tournament_attempts")
    .select("user_id, score, wrong_count, duration_used_seconds, submitted_at")
    .eq("tournament_id", tournamentId)
    .not("submitted_at", "is", null);

  const valid = attempts ?? [];
  if (valid.length < t.min_participants) {
    await supabaseAdmin.from("tournaments")
      .update({ status: "cancelled", winner_decided_at: new Date().toISOString() })
      .eq("id", tournamentId);
    return;
  }

  valid.sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    if ((a.duration_used_seconds ?? 0) !== (b.duration_used_seconds ?? 0))
      return (a.duration_used_seconds ?? 0) - (b.duration_used_seconds ?? 0);
    if ((a.wrong_count ?? 0) !== (b.wrong_count ?? 0))
      return (a.wrong_count ?? 0) - (b.wrong_count ?? 0);
    return new Date(a.submitted_at!).getTime() - new Date(b.submitted_at!).getTime();
  });

  const w = valid[0];
  await supabaseAdmin.from("tournament_winners").insert({
    tournament_id: tournamentId,
    user_id: w.user_id,
    prize_amount: t.prize_amount,
  });
  await supabaseAdmin.from("tournaments").update({
    status: "completed",
    winner_user_id: w.user_id,
    winner_decided_at: new Date().toISOString(),
  }).eq("id", tournamentId);
}

export const finalizeTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await finalizeInternal(data.id);
    return { ok: true };
  });

export const registerForTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabaseAdmin.from("tournaments")
        .select("target_school, target_department, target_level, registration_open, status")
        .eq("id", data.id).single(),
      supabaseAdmin.from("profiles").select("school, department, level").eq("id", context.userId).single(),
    ]);
    if (!t) throw new Error("Tournament not found");
    if (!t.registration_open) throw new Error("Registration is closed for this tournament");
    if (t.status === "completed" || t.status === "cancelled") throw new Error("Tournament is no longer accepting registrations");
    if (!p) throw new Error("Complete your profile first");
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    if (norm(p.school) !== norm(t.target_school) ||
        norm(p.department) !== norm(t.target_department) ||
        norm(p.level) !== norm(t.target_level)) {
      throw new Error("You're not eligible: your school, department, and level must match this tournament.");
    }
    const { error } = await supabaseAdmin.from("tournament_registrations")
      .insert({ tournament_id: data.id, user_id: context.userId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const startTournamentAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: t } = await supabaseAdmin.from("tournaments").select("*").eq("id", data.id).single();
    if (!t) throw new Error("Tournament not found");
    if (t.status === "completed" || t.status === "cancelled") throw new Error("Tournament is closed");
    if (t.ends_at && new Date(t.ends_at).getTime() < Date.now()) throw new Error("Tournament time has ended");

    const { data: p } = await supabaseAdmin.from("profiles").select("school, department, level").eq("id", context.userId).single();
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    if (!p || norm(p.school) !== norm(t.target_school) ||
        norm(p.department) !== norm(t.target_department) ||
        norm(p.level) !== norm(t.target_level)) {
      throw new Error("You're not eligible for this tournament.");
    }

    const { data: reg } = await supabaseAdmin.from("tournament_registrations")
      .select("id").eq("tournament_id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!reg) throw new Error("You must register first");

    const pool = await getDonationPool();
    if (pool.available < Number(t.prize_amount)) {
      throw new Error("Tournament paused: donation pool can't cover the prize yet. Please donate or check back later.");
    }

    const { data: existing } = await supabaseAdmin.from("tournament_attempts")
      .select("id").eq("tournament_id", data.id).eq("user_id", context.userId).maybeSingle();
    if (existing) return { attemptId: existing.id };

    const { data: questions } = await supabaseAdmin
      .from("questions").select("id").eq("course_id", t.course_id);
    if (!questions || questions.length === 0) throw new Error("This tournament's course has no questions");
    const pickN = Math.min(t.question_count, questions.length);
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, pickN).map((q) => q.id);
    const expiresAt = new Date(Date.now() + t.duration_seconds * 1000).toISOString();

    const { data: att, error } = await supabaseAdmin.from("tournament_attempts").insert({
      tournament_id: data.id,
      user_id: context.userId,
      question_ids: shuffled,
      expires_at: expiresAt,
    }).select("id").single();
    if (error) throw new Error(error.message);

    if (t.status === "upcoming") {
      await supabaseAdmin.from("tournaments").update({ status: "active" }).eq("id", data.id);
    }
    return { attemptId: att.id };
  });

export const getTournamentAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: att, error } = await supabaseAdmin.from("tournament_attempts")
      .select("*, tournaments(title, course_id, courses(code, title))")
      .eq("id", data.attemptId).eq("user_id", context.userId).single();
    if (error || !att) throw new Error("Attempt not found");
    const ids = att.question_ids as string[];
    const { data: questions } = await supabaseAdmin.from("questions")
      .select("id, prompt, options").in("id", ids);
    const ordered = ids.map((id) => questions?.find((q) => q.id === id)).filter(Boolean) as Array<{ id: string; prompt: string; options: unknown }>;
    return {
      attempt: {
        id: att.id,
        tournamentId: att.tournament_id,
        title: att.tournaments?.title ?? "Tournament",
        courseCode: att.tournaments?.courses?.code ?? "",
        courseTitle: att.tournaments?.courses?.title ?? "",
        submittedAt: att.submitted_at,
        score: att.score,
        total: ids.length,
        expiresAt: att.expires_at,
        startedAt: att.started_at,
      },
      questions: ordered.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options as string[] })),
    };
  });

export const submitTournamentAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    attemptId: z.string().uuid(),
    answers: z.array(z.object({ questionId: z.string().uuid(), chosenIndex: z.number().int().min(-1).max(3) })),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: att } = await supabaseAdmin.from("tournament_attempts")
      .select("id, user_id, submitted_at, started_at, tournament_id")
      .eq("id", data.attemptId).single();
    if (!att) throw new Error("Attempt not found");
    if (att.user_id !== context.userId) throw new Error("Forbidden");
    if (att.submitted_at) return { ok: true };

    const ids = data.answers.map((a) => a.questionId);
    const { data: qs } = await supabaseAdmin.from("questions").select("id, correct_index").in("id", ids);
    const correct = new Map<string, number>();
    qs?.forEach((q) => correct.set(q.id, q.correct_index));

    let score = 0;
    let wrong = 0;
    for (const a of data.answers) {
      const c = correct.get(a.questionId);
      if (c !== undefined && a.chosenIndex === c) score++;
      else wrong++;
    }
    const now = new Date();
    const used = Math.max(1, Math.floor((now.getTime() - new Date(att.started_at).getTime()) / 1000));
    await supabaseAdmin.from("tournament_attempts").update({
      submitted_at: now.toISOString(),
      score,
      wrong_count: wrong,
      duration_used_seconds: used,
    }).eq("id", data.attemptId);
    return { ok: true, score, wrong };
  });

export const submitPayoutForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    tournamentId: z.string().uuid(),
    bankName: z.string().trim().min(2).max(100),
    accountNumber: z.string().trim().min(5).max(30),
    accountName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(5).max(30),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: w } = await supabaseAdmin.from("tournament_winners")
      .select("id, user_id, payout_status").eq("tournament_id", data.tournamentId).single();
    if (!w) throw new Error("No winner record");
    if (w.user_id !== context.userId) throw new Error("Forbidden");
    if (w.payout_status === "paid") throw new Error("Already paid");
    const { error } = await supabaseAdmin.from("tournament_winners").update({
      payout_status: "pending_approval",
      payout_details: {
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        phone: data.phone,
      },
    }).eq("id", w.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approvePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ winnerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("tournament_winners").update({
      payout_status: "paid",
      approved_by: context.userId,
      approved_at: new Date().toISOString(),
    }).eq("id", data.winnerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllTimeWinners = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("tournament_winners")
    .select("id, user_id, prize_amount, decided_at, payout_status, tournaments(title, target_school, target_department, target_level, courses(code))")
    .order("decided_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((data ?? []).map((d) => d.user_id)));
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
    profs?.forEach((p) => names.set(p.id, p.full_name ?? ""));
  }
  return (data ?? []).map((w) => ({ ...w, winner_name: names.get(w.user_id) ?? null }));
});

export const listPendingPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("tournament_winners")
      .select("id, user_id, prize_amount, payout_status, payout_details, decided_at, tournaments(title)")
      .in("payout_status", ["pending_form", "pending_approval"])
      .order("decided_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((d) => d.user_id)));
    const profs = new Map<string, { full_name: string | null; email: string | null }>();
    if (ids.length) {
      const { data: rows } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids);
      rows?.forEach((p) => profs.set(p.id, { full_name: p.full_name, email: p.email }));
    }
    return (data ?? []).map((w) => ({ ...w, winner: profs.get(w.user_id) ?? null }));
  });

export const listMyTournamentState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: reg }, { data: att }] = await Promise.all([
      supabaseAdmin.from("tournament_registrations").select("id").eq("tournament_id", data.id).eq("user_id", context.userId).maybeSingle(),
      supabaseAdmin.from("tournament_attempts").select("id, submitted_at, score").eq("tournament_id", data.id).eq("user_id", context.userId).maybeSingle(),
    ]);
    return { registered: !!reg, attempt: att ?? null };
  });
