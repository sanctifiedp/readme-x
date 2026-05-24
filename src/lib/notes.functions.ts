import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const listNotes = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      q: z.string().trim().max(120).optional(),
      school: z.string().trim().max(120).optional(),
      department: z.string().trim().max(120).optional(),
      level: z.string().trim().max(20).optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin.from("notes").select("*").order("created_at", { ascending: false });
    if (data.school) q = q.ilike("school", `%${data.school}%`);
    if (data.department) q = q.ilike("department", `%${data.department}%`);
    if (data.level) q = q.ilike("level", `%${data.level}%`);
    if (data.q) q = q.or(`title.ilike.%${data.q}%,description.ilike.%${data.q}%,course_code.ilike.%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    
    const signed = await Promise.all(
      rows.map(async (n) => {
        let fileUrl: string | null = null;
        if (n.file_path) {
          const { data: s } = await supabaseAdmin.storage
            .from("notes")
            .createSignedUrl(n.file_path, 60 * 60);
          fileUrl = s?.signedUrl ?? null;
        }
        return {
          id: n.id,
          title: n.title,
          description: n.description,
          school: n.school,
          department: n.department,
          level: n.level,
          courseCode: n.course_code,
          link: n.link,
          fileUrl,
          createdAt: n.created_at,
        };
      }),
    );
    return signed;

  });

export const createNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      title: z.string().trim().min(2).max(200),
      description: z.string().trim().max(2000).optional(),
      school: z.string().trim().max(120).optional(),
      department: z.string().trim().max(120).optional(),
      level: z.string().trim().max(20).optional(),
      courseCode: z.string().trim().max(40).optional(),
      link: z.string().url().max(500).optional().or(z.literal("")),
      filePath: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (!data.link && !data.filePath) throw new Error("Provide a link or upload a file");
    const { error } = await supabaseAdmin.from("notes").insert({
      title: data.title,
      description: data.description ?? null,
      school: data.school ?? null,
      department: data.department ?? null,
      level: data.level ?? null,
      course_code: data.courseCode ?? null,
      link: data.link || null,
      file_path: data.filePath || null,
      uploaded_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row } = await supabaseAdmin.from("notes").select("file_path").eq("id", data.id).single();
    if (row?.file_path) {
      await supabaseAdmin.storage.from("notes").remove([row.file_path]);
    }
    const { error } = await supabaseAdmin.from("notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
