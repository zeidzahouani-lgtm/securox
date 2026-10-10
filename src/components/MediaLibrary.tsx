import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteMedia, listMedia, signedUrls, uploadMedia } from "@/lib/media";
import { MediaView } from "./MediaView";

export function useMediaWithUrls() {
  const media = useQuery({ queryKey: ["media"], queryFn: listMedia });
  const urls = useQuery({
    queryKey: ["media-urls", (media.data ?? []).map((m) => m.path).join(",")],
    queryFn: () => signedUrls((media.data ?? []).map((m) => m.path)),
    enabled: !!media.data,
    staleTime: 30 * 60 * 1000,
  });
  return { media, urls: urls.data ?? {} };
}

export function MediaLibrary() {
  const qc = useQueryClient();
  const { media, urls } = useMediaWithUrls();
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "image" | "video" | "application/pdf">("all");
  const up = useMutation({
    mutationFn: async (files: File[]) => { for (const f of files) await uploadMedia(f); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
    onError: (e: Error) => setErr(e.message),
  });
  const del = useMutation({ mutationFn: deleteMedia, onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }) });
  const items = (media.data ?? []).filter((m) => filter === "all" || m.mime.startsWith(filter));

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-lg p-6">
        <h2 className="mb-1 font-display text-xl font-bold">Médiathèque</h2>
        <p className="mb-4 text-sm text-muted-foreground">Photos, vidéos et PDF (50 Mo max par fichier). Utilisez-les ensuite dans vos menus et points de vente.</p>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 p-8 text-sm hover:bg-muted/40">
          {up.isPending ? <Loader2 className="size-8 animate-spin text-primary" /> : <Upload className="size-8 text-primary" />}
          <span className="font-semibold">{up.isPending ? "Envoi en cours…" : "Cliquez pour ajouter des fichiers"}</span>
          <input type="file" multiple accept="image/*,video/*,application/pdf" className="hidden"
            onChange={(e) => { setErr(null); const f = Array.from(e.target.files ?? []); if (f.length) up.mutate(f); e.target.value = ""; }} />
        </label>
        {err && <p className="mt-2 text-sm text-rose">{err}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {([["all", "Tout"], ["image", "Photos"], ["video", "Vidéos"], ["application/pdf", "PDF"]] as const).map(([k, l]) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{l}</Button>
        ))}
      </div>
      {media.isLoading ? <Loader2 className="mx-auto size-6 animate-spin text-primary" /> : !items.length ? (
        <p className="text-sm text-muted-foreground">Aucun fichier.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <div key={m.id} className="glass-panel rounded-lg p-2">
              {urls[m.path] ? <MediaView url={urls[m.path]!} mime={m.mime} name={m.name} compact /> : <div className="h-32 rounded-md bg-muted" />}
              <div className="mt-2 flex items-center gap-1">
                <p className="flex-1 truncate text-xs" title={m.name}>{m.name}</p>
                <Button size="icon" variant="ghost" aria-label="Supprimer" className="text-rose"
                  onClick={() => confirm(`Supprimer « ${m.name} » ?`) && del.mutate(m)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
