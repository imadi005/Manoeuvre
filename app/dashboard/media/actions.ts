"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { notifyDocumentationReady } from "@/lib/notify";

type ActionResult = { error: string | null };

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB — geotagged originals can be large

export async function uploadPhoto(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "media") return { error: "Not authorized." };

  const eventSlug = String(formData.get("eventSlug") ?? "");
  const photoType = String(formData.get("photoType") ?? "");
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);

  if (!eventSlug) return { error: "Missing event." };
  if (photoType !== "geotagged" && photoType !== "normal") return { error: "Invalid photo type." };
  if (files.length === 0) return { error: "Choose at least one file first." };

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) return { error: `${file.name} is too large (max 15MB).` };
    if (!file.type.startsWith("image/")) return { error: `${file.name} isn't an image.` };
  }

  const supabase = createAdminClient();

  const { data: result } = await supabase
    .from("event_results")
    .select("status")
    .eq("event_slug", eventSlug)
    .maybeSingle();
  if (!result || result.status !== "published") {
    return { error: "This event isn't closed yet." };
  }

  const failures: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${eventSlug}/${photoType}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from("event-photos").upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      failures.push(file.name);
      continue;
    }

    const { error: insertError } = await supabase.from("event_photos").insert({
      event_slug: eventSlug,
      storage_path: path,
      photo_type: photoType,
      uploaded_by: session.id,
    });
    if (insertError) failures.push(file.name);
  }

  revalidatePath("/dashboard/media");
  if (failures.length > 0) {
    return { error: `${failures.length} of ${files.length} failed to upload: ${failures.join(", ")}` };
  }
  return { error: null };
}

export async function removePhoto(photoId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "media") return { error: "Not authorized." };

  const supabase = createAdminClient();
  const { data: photo } = await supabase.from("event_photos").select("storage_path").eq("id", photoId).maybeSingle();
  if (!photo) return { error: "Photo not found." };

  await supabase.storage.from("event-photos").remove([photo.storage_path]);
  const { error } = await supabase.from("event_photos").delete().eq("id", photoId);
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/media");
  return { error: null };
}

/** Explicit hand-off once media is confident they've uploaded what's needed — not auto-fired on first upload, since photos usually come in batches. */
export async function notifyDocumentationTeam(eventSlug: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "media") return { error: "Not authorized." };

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
