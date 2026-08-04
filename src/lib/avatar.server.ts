import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const AVATAR_BUCKET = "avatars";
export const AVATAR_PREFIX = "storage:";
export const AVATAR_MAX_BYTES = 3 * 1024 * 1024; // 3MB
export const AVATAR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Turn a stored avatar_url value into something the browser can render. */
export async function resolveAvatarUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  if (!stored.startsWith(AVATAR_PREFIX)) return stored; // legacy external URL
  const path = stored.slice(AVATAR_PREFIX.length);
  const { data, error } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Parse and validate a data URL into raw bytes. */
export function decodeAvatarDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string; ext: string } {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data.");
  const mime = match[1]!.toLowerCase();
  const ext = AVATAR_MIME[mime];
  if (!ext) throw new Error("Only PNG, JPEG, WebP or GIF images are allowed.");
  const buf = Buffer.from(match[2]!, "base64");
  if (buf.byteLength === 0) throw new Error("Image is empty.");
  if (buf.byteLength > AVATAR_MAX_BYTES) throw new Error("Image must be 3MB or smaller.");
  return { bytes: new Uint8Array(buf), mime, ext };
}

/** Remove every previously stored avatar object for a user. */
export async function clearAvatarFolder(userId: string) {
  const { data } = await supabaseAdmin.storage.from(AVATAR_BUCKET).list(userId);
  const paths = (data ?? []).map((f) => `${userId}/${f.name}`);
  if (paths.length) await supabaseAdmin.storage.from(AVATAR_BUCKET).remove(paths);
}
