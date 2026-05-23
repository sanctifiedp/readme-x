import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

// Public: approved donors deduplicated, sorted by donation count desc.
export const listDonors = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("donations")
    .select("donor_name, message, approved_at")
    .eq("status", "approved")
    .order("approved_at", { ascending: false });
  if (error) throw new Error(error.message);

  const map = new Map<string, { name: string; count: number; lastAt: string; message: string | null }>();
  for (const d of data ?? []) {
    const key = d.donor_name.trim().toLowerCase();
    const ex = map.get(key);
    if (ex) {
      ex.count += 1;
      if (!ex.message && d.message) ex.message = d.message;
    } else {
      map.set(key, { name: d.donor_name.trim(), count: 1, lastAt: d.approved_at ?? "", message: d.message });
    }
  }
  const donors = Array.from(map.values()).sort((a, b) =>
    b.count - a.count || a.name.localeCompare(b.name),
  );
  return { donors, total: data?.length ?? 0, uniqueCount: donors.length };
});

export const submitDonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      donorName: z.string().trim().min(2).max(120),
      amount: z.number().positive().max(10_000_000),
      reference: z.string().trim().max(200).optional(),
      message: z.string().trim().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.from("donations").insert({
      user_id: context.userId,
      donor_name: data.donorName,
      amount: data.amount,
      reference: data.reference ?? null,
      message: data.message ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPendingDonations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("donations")
      .select("id, donor_name, amount, reference, message, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const decideDonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("donations")
      .update({ status: data.decision, approved_at: new Date().toISOString(), approved_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
