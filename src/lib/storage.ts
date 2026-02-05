import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_PREVIEW_TTL_SECONDS = 300;
export const DEFAULT_DOWNLOAD_TTL_SECONDS = 60;

export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = DEFAULT_DOWNLOAD_TTL_SECONDS
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Signed URL not returned by Supabase");
  return data.signedUrl;
}

export function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}
