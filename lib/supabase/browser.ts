import { createClient } from "@supabase/supabase-js";

/** Browser-side client, publishable key only — used solely for uploading
 * directly to Storage via signed upload URLs the server hands out. Never
 * carries the service role key, never touches the database directly. */
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
