"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { notifyDocumentationReady } from "@/lib/notify";

type ActionResult = { error: string | null };

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB — geotagged originals can be large
const MAX_BATCH = 500; // sanity cap per request, well above the 200-400 the team actually sends at once

// An event is open for media once its result has at least been submitted by
// the event lead -- matches the leaderboard's own gate (lib/scoring.ts callers)
// rather than waiting for the full faculty + control-room chain to finish.
const OPEN_STATUSES = ["submitted", "faculty_approved", "published"];

async function requireMediaSession() {
  const session = await getSession();
  if (!session || session.role !== "media") return null;
  return session;
}

async function assertEventOpen(eventSlug: string) {
  const supabase = createAdminClient();
  const { data: result } = await supabase.from("event_results").select("status").eq("event_slug", eventSlug).maybeSingle();
  return !!result && OPEN_STATUSES.includes(result.status);
}

export interface UploadTarget {
  name: string;
  path: string;
  signedUrl: string;
  token: string;
}

/** Step 1 of the direct-to-storage flow: hand the browser a signed upload URL
 * per file, generated with the service-role key server-side, so the actual
 * image bytes go straight from the browser to Supabase Storage and never
 * pass through our own server -- no request-body limit, no function timeout,
 * scales to hundreds of files in one batch. */
export async function createUploadTargets(
  eventSlug: string,
  photoType: "geotagged" | "normal",
  files: { name: string; type: string; size: number }[]
): Promise<{ targets: UploadTarget[]; error: string | null }> {
  const session = await requireMediaSession();
  if (!session) return { targets: [], error: "Not authorized." };
  if (photoType !== "geotagged" && photoType !== "normal") return { targets: [], error: "Invalid photo type." };
  if (files.length === 0) return { targets: [], error: "No files given." };
  if (files.length > MAX_BATCH) return { targets: [], error: `Too many files at once (max ${MAX_BATCH}).` };

  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) return { targets: [], error: `${f.name} is too large (max 15MB).` };
    if (!f.type.startsWith("image/")) return { targets: [], error: `${f.name} isn't an image.` };
  }

  if (!(await assertEventOpen(eventSlug))) return { targets: [], error: "This event isn't open for photos yet." };

  const supabase = createAdminClient();
  const targets: UploadTarget[] = [];
  for (const f of files) {
    const ext = f.name.split(".").pop() || "jpg";
    const path = `${eventSlug}/${photoType}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage.from("event-photos").createSignedUploadUrl(path);
    if (error || !data) continue; // surfaced to the user as a per-file failure on the client, not a hard stop
    targets.push({ name: f.name, path, signedUrl: data.signedUrl, token: data.token });
  }

  if (targets.length === 0) return { targets: [], error: "Couldn't prepare uploads. Try again." };
  return { targets, error: null };
}

/** Step 2: once the browser has PUT each file to its signed URL, record the
 * ones that actually succeeded. */
export async function confirmUploads(
  eventSlug: string,
  photoType: "geotagged" | "normal",
  paths: string[]
): Promise<ActionResult> {
  const session = await requireMediaSession();
  if (!session) return { error: "Not authorized." };
  if (paths.length === 0) return { error: null };

  const supabase = createAdminClient();
  const { error } = await supabase.from("event_photos").insert(
    paths.map((path) => ({ event_slug: eventSlug, storage_path: path, photo_type: photoType, uploaded_by: session.id }))
  );
  if (error) return { error: "Uploaded, but saving the record failed. Refresh and check before re-uploading." };

  revalidatePath("/dashboard/media");
  revalidatePath(`/events/${eventSlug}`);
  return { error: null };
}

export async function removePhoto(photoId: string): Promise<ActionResult> {
  const session = await requireMediaSession();
  if (!session) return { error: "Not authorized." };

  const supabase = createAdminClient();
  const { data: photo } = await supabase.from("event_photos").select("event_slug, storage_path").eq("id", photoId).maybeSingle();
  if (!photo) return { error: "Photo not found." };

  await supabase.storage.from("event-photos").remove([photo.storage_path]);
  const { error } = await supabase.from("event_photos").delete().eq("id", photoId);
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/media");
  revalidatePath(`/events/${photo.event_slug}`);
  return { error: null };
}

/** Explicit hand-off once media is confident they've uploaded what's needed -- not auto-fired on first upload, since photos usually come in batches. */
export async function notifyDocumentationTeam(eventSlug: string): Promise<ActionResult> {
  const session = await requireMediaSession();
  if (!session) return { error: "Not authorized." };

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("event_photos")
    .select("id", { count: "exact", head: true })
    .eq("event_slug", eventSlug);
  if (!count || count === 0) return { error: "Upload at least one photo before notifying documentation." };

  await notifyDocumentationReady(eventSlug);
  revalidatePath("/dashboard/media");
  return { error: null };
}
