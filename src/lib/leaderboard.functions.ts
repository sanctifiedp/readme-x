import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const scopeSchema = z.enum(["global", "school", "faculty", "department", "level", "course"]);
const windowSchema = z.enum(["weekly", "monthly", "all"]);

export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        scope: scopeSchema.default("global"),
        scopeValue: z.string().optional(),
        window: windowSchema.default("all"),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("leaderboard", {
      _scope: data.scope,
      _scope_value: data.scopeValue ?? undefined,
      _window: data.window,
      _limit: data.limit,
    });
    if (error) throw new Error(error.message);
    const { resolveAvatarUrl } = await import("@/lib/avatar.server");
    const list = (rows ?? []) as Array<{
      user_id: string;
      username: string | null;
      full_name: string | null;
      avatar_url: string | null;
      school: string | null;
      department: string | null;
      level: string | null;
      xp: number;
      rank: number;
    }>;
    return Promise.all(
      list.map(async (r) => ({ ...r, avatar_url: await resolveAvatarUrl(r.avatar_url) })),
    );
  });


export const getLeaderboardFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("school, faculty, department, level")
      .eq("id", userId)
      .single();

    const { data: courses } = await supabaseAdmin
      .from("courses")
      .select("id, code, title")
      .order("code")
      .limit(500);

    return { profile: profile ?? null, courses: courses ?? [] };
  });

export const getMyBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const [{ data: earned }, { data: all }] = await Promise.all([
      supabaseAdmin
        .from("user_badges")
        .select("earned_at, badges(id, code, name, description, icon)")
        .eq("user_id", userId),
      supabaseAdmin.from("badges").select("id, code, name, description, icon").order("code"),
    ]);
    const earnedIds = new Set((earned ?? []).map((r) => r.badges?.id).filter(Boolean) as string[]);
    return {
      earned: (earned ?? []).map((r) => ({
        code: r.badges?.code ?? "",
        name: r.badges?.name ?? "",
        description: r.badges?.description ?? "",
        icon: r.badges?.icon ?? "",
        earnedAt: r.earned_at,
      })),
      locked: (all ?? [])
        .filter((b) => !earnedIds.has(b.id))
        .map((b) => ({ code: b.code, name: b.name, description: b.description ?? "", icon: b.icon ?? "" })),
    };
  });
