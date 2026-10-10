import { publicOrigin } from "@/lib/gate";
import { supabase } from "@/integrations/supabase/client";

export type MediaItem = { id: string; name: string; path: string; mime: string; size: number; created_at: string };
export type Outlet = { id: string; name: string; description: string | null; media_ids: string[]; public_token: string; created_at: string };
export type PublicMedia = { name: string; path: string; mime: string };

export async function listMedia(): Promise<MediaItem[]> {
  const { data, error } = await supabase.from("media_items").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MediaItem[];
}

export async function uploadMedia(file: File) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `library/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("menus").upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { error: e2 } = await supabase.from("media_items").insert({ name: file.name, path, mime: file.type, size: file.size });
  if (e2) throw e2;
}

export async function deleteMedia(m: MediaItem) {
  await supabase.storage.from("menus").remove([m.path]);
  const { error } = await supabase.from("media_items").delete().eq("id", m.id);
  if (error) throw error;
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from("menus").createSignedUrls(paths, 3600);
  if (error) throw error;
  const out: Record<string, string> = {};
  (data ?? []).forEach((d) => { if (d.path && d.signedUrl) out[d.path] = d.signedUrl; });
  return out;
}

export async function listOutlets(): Promise<Outlet[]> {
  const { data, error } = await supabase.from("outlets").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Outlet[];
}
export async function saveOutlet(o: { id?: string; name: string; description: string; media_ids: string[] }) {
  const row = { name: o.name, description: o.description || null, media_ids: o.media_ids };
  const { error } = o.id
    ? await supabase.from("outlets").update(row).eq("id", o.id)
    : await supabase.from("outlets").insert(row);
  if (error) throw error;
}
export async function deleteOutlet(id: string) {
  const { error } = await supabase.from("outlets").delete().eq("id", id);
  if (error) throw error;
}
export async function outletPublic(token: string): Promise<{ name: string; description: string | null; media: PublicMedia[] } | null> {
  const { data, error } = await (supabase.rpc as any)("outlet_public", { _token: token });
  if (error) throw error;
  return data;
}
export const outletUrl = (token: string) => `${publicOrigin()}/p/${token}`;
export const kind = (mime: string, path = "") =>
  mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime === "application/pdf" || path.endsWith(".pdf") ? "pdf" : "file";
