import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const QUESTION_IMAGE_BUCKET = "question-images";
export const QUESTION_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const QUESTION_IMAGE_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

/** Signed URL for a stored question image (private bucket). */
export async function resolveQuestionImageUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(QUESTION_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Resolve many image paths at once, returning a path -> url map. */
export async function resolveQuestionImageUrls(
  paths: Array<string | null | undefined>,
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const out: Record<string, string> = {};
  await Promise.all(
    unique.map(async (p) => {
      const url = await resolveQuestionImageUrl(p);
      if (url) out[p] = url;
    }),
  );
  return out;
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string; ext: string } {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data.");
  const mime = match[1]!.toLowerCase();
  const ext = QUESTION_IMAGE_MIME[mime];
  if (!ext) throw new Error("Only PNG, JPG, JPEG or WebP images are allowed.");
  const buf = Buffer.from(match[2]!, "base64");
  if (buf.byteLength === 0) throw new Error("Image is empty.");
  if (buf.byteLength > QUESTION_IMAGE_MAX_BYTES) throw new Error("Image must be 5MB or smaller.");
  return { bytes: new Uint8Array(buf), mime, ext };
}

/** Upload a base64 data URL into the private bucket; returns the storage path. */
export async function uploadQuestionImage(courseId: string, dataUrl: string): Promise<string> {
  const { bytes, mime, ext } = decodeDataUrl(dataUrl);
  const path = `${courseId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Best-effort delete; never blocks the caller. */
export async function deleteQuestionImage(path: string | null | undefined) {
  if (!path) return;
  await supabaseAdmin.storage.from(QUESTION_IMAGE_BUCKET).remove([path]);
}
