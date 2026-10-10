import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteOutlet, listOutlets, outletUrl, saveOutlet, type Outlet } from "@/lib/media";
import { downloadQrJpg } from "@/lib/qrimage";
import { useMediaWithUrls } from "./MediaLibrary";
import { MediaView } from "./MediaView";

type Draft = { id?: string; name: string; description: string; media_ids: string[] };
const empty: Draft = { name: "", description: "", media_ids: [] };

export function OutletsTab() {
  const qc = useQueryClient();
  const outlets = useQuery({ queryKey: ["outlets"], queryFn: listOutlets });
  const { media, urls } = useMediaWithUrls();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => saveOutlet(draft!),
    onSuccess: () => { setDraft(null); qc.invalidateQueries({ queryKey: ["outlets"] }); },
    onError: (e: Error) => setErr(e.message),
  });
  const del = useMutation({ mutationFn: deleteOutlet, onSuccess: () => qc.invalidateQueries({ queryKey: ["outlets"] }) });
  const toggle = (id: string) => setDraft((d) => d && ({ ...d, media_ids: d.media_ids.includes(id) ? d.media_ids.filter((x) => x !== id) : [...d.media_ids, id] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Menus & points de vente</h2>
          <p className="text-sm text-muted-foreground">Chaque page a son QR code : l'invité le scanne avec son téléphone et voit le menu.</p>
        </div>
        {!draft && <Button onClick={() => { setErr(null); setDraft(empty); }}><Plus className="size-4" /> Nouvelle page</Button>}
      </div>

      {draft && (
        <div className="glass-panel space-y-3 rounded-lg p-6">
          <input className="field-input" placeholder="Nom (ex : Restaurant La Terrasse, Bar piscine)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <textarea className="field-input min-h-20" placeholder="Description (optionnelle)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <p className="text-sm font-semibold">Contenu affiché ({draft.media_ids.length} sélectionné(s)) — choisissez dans la médiathèque :</p>
          {!(media.data ?? []).length ? <p className="text-sm text-muted-foreground">La médiathèque est vide. Ajoutez d'abord des fichiers.</p> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(media.data ?? []).map((m) => {
                const pos = draft.media_ids.indexOf(m.id);
                return (
                  <button type="button" key={m.id} onClick={() => toggle(m.id)}
                    className={`relative rounded-lg border-2 p-1 text-left ${pos >= 0 ? "border-primary" : "border-border"}`}>
                    {urls[m.path] ? <MediaView url={urls[m.path]!} mime={m.mime} name={m.name} compact /> : <div className="h-32 rounded-md bg-muted" />}
                    <p className="mt-1 truncate text-xs">{m.name}</p>
                    {pos >= 0 && <span className="absolute right-2 top-2 rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">{pos + 1}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {err && <p className="text-sm text-rose">{err}</p>}
          <div className="flex gap-2">
            <Button disabled={!draft.name.trim() || save.isPending} onClick={() => save.mutate()}>Enregistrer</Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>Annuler</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(outlets.data ?? []).map((o) => <OutletCard key={o.id} o={o} onEdit={() => setDraft({ id: o.id, name: o.name, description: o.description ?? "", media_ids: o.media_ids })} onDelete={() => confirm(`Supprimer « ${o.name} » ?`) && del.mutate(o.id)} />)}
        {outlets.data && !outlets.data.length && !draft && <p className="text-sm text-muted-foreground">Aucune page pour l'instant.</p>}
      </div>
    </div>
  );
}

function OutletCard({ o, onEdit, onDelete }: { o: Outlet; onEdit: () => void; onDelete: () => void }) {
  const url = outletUrl(o.public_token);
  return (
    <div className="glass-panel flex gap-4 rounded-lg p-4">
      <div className="h-fit rounded-md bg-paper p-2"><QRCodeSVG value={url} size={110} /></div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-display font-semibold break-words">{o.name}</p>
        <p className="text-xs text-muted-foreground">{o.media_ids.length} élément(s)</p>
        <div className="flex flex-wrap gap-1 pt-1">
          <Button size="sm" variant="outline" onClick={() => downloadQrJpg({ value: url, title: o.name, subtitle: "Scannez pour voir le menu", fileName: `qr-menu-${o.name}` })}><Download className="size-3.5" /> QR (JPG)</Button>
          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(url)}><Copy className="size-3.5" /> Lien</Button>
          <Button size="sm" variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer">Voir</a></Button>
          <Button size="icon" variant="ghost" aria-label="Modifier" onClick={onEdit}><Pencil className="size-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Supprimer" className="text-rose" onClick={onDelete}><Trash2 className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
