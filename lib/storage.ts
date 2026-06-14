import { supabaseAdmin } from "@/lib/supabase";

const ensured = new Set<string>();

/**
 * Ensure a public Storage bucket exists (best-effort, cached per process).
 * Requires the service-role client.
 */
async function ensureBucket(bucket: string): Promise<void> {
  if (ensured.has(bucket)) return;
  try {
    const { data } = await supabaseAdmin.storage.getBucket(bucket);
    if (!data) {
      await supabaseAdmin.storage.createBucket(bucket, { public: true });
    }
  } catch {
    // Bucket may already exist or creation may be restricted; uploads below
    // will surface any real problem.
  }
  ensured.add(bucket);
}

/**
 * Upload bytes to a public bucket and return the public URL.
 * Creates the bucket (public) on first use if it doesn't exist.
 */
export async function uploadPublic(
  bucket: string,
  path: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await ensureBucket(bucket);

  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Storage upload failed (${bucket}/${path}): ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
