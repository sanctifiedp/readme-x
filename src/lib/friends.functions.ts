import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizePostgrestTerm } from "./search-sanitize";

export const searchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ q: z.string().trim().min(1).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const safe = sanitizePostgrestTerm(data.q);
    if (!safe) return { users: [] };
    const term = `%${safe}%`;
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, matric_no, school, department, level")
      .or(`full_name.ilike.${term},email.ilike.${term},matric_no.ilike.${term}`)
      .neq("id", userId)
      .limit(20);
    if (error) throw new Error(error.message);
    return { users: rows ?? [] };
  });

export const listFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: rows, error } = await supabaseAdmin
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at, accepted_at")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    if (error) throw new Error(error.message);
    const allIds = new Set<string>();
    rows?.forEach((r) => { allIds.add(r.requester_id); allIds.add(r.addressee_id); });
    allIds.delete(userId);
    const { data: profs } = allIds.size > 0
      ? await supabaseAdmin.from("profiles").select("id, full_name, email, matric_no").in("id", Array.from(allIds))
      : { data: [] as any[] };
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const map = (r: any) => {
      const other = r.requester_id === userId ? r.addressee_id : r.requester_id;
      const direction = r.requester_id === userId ? "outgoing" : "incoming";
      return {
        id: r.id,
        status: r.status as "pending" | "accepted" | "declined",
        direction,
        otherUser: pmap.get(other) ?? { id: other, full_name: "Unknown", email: "", matric_no: "" },
        createdAt: r.created_at,
        acceptedAt: r.accepted_at,
      };
    };
    const all = (rows ?? []).map(map);
    return {
      friends: all.filter((r) => r.status === "accepted"),
      incoming: all.filter((r) => r.status === "pending" && r.direction === "incoming"),
      outgoing: all.filter((r) => r.status === "pending" && r.direction === "outgoing"),
    };
  });

export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ targetUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.targetUserId === userId) throw new Error("Cannot friend yourself");
    // Check existing
    const { data: existing } = await supabaseAdmin
      .from("friendships")
      .select("id, status, requester_id, addressee_id")
      .or(`and(requester_id.eq.${userId},addressee_id.eq.${data.targetUserId}),and(requester_id.eq.${data.targetUserId},addressee_id.eq.${userId})`)
      .maybeSingle();
    if (existing) {
      if (existing.status === "accepted") throw new Error("Already friends");
      if (existing.status === "pending") throw new Error("A request already exists");
      // declined → resend by updating row
      const { error: uerr } = await supabaseAdmin
        .from("friendships")
        .update({ status: "pending", requester_id: userId, addressee_id: data.targetUserId, accepted_at: null })
        .eq("id", existing.id);
      if (uerr) throw new Error(uerr.message);
      return { ok: true };
    }
    const { error } = await supabaseAdmin
      .from("friendships")
      .insert({ requester_id: userId, addressee_id: data.targetUserId, status: "pending" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const respondToRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    friendshipId: z.string().uuid(),
    action: z.enum(["accept", "decline"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: row, error } = await supabaseAdmin
      .from("friendships").select("id, addressee_id, status").eq("id", data.friendshipId).single();
    if (error || !row) throw new Error("Request not found");
    if (row.addressee_id !== userId) throw new Error("Forbidden");
    if (row.status !== "pending") throw new Error("Already handled");
    const update = data.action === "accept"
      ? { status: "accepted", accepted_at: new Date().toISOString() }
      : { status: "declined" };
    const { error: uerr } = await supabaseAdmin.from("friendships").update(update).eq("id", data.friendshipId);
    if (uerr) throw new Error(uerr.message);
    return { ok: true };
  });

export const removeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ friendshipId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: row } = await supabaseAdmin
      .from("friendships").select("id, requester_id, addressee_id").eq("id", data.friendshipId).single();
    if (!row) throw new Error("Not found");
    if (row.requester_id !== userId && row.addressee_id !== userId) throw new Error("Forbidden");
    const { error } = await supabaseAdmin.from("friendships").delete().eq("id", data.friendshipId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
