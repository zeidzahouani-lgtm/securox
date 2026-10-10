import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Download, Lock, UtensilsCrossed, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  closeEventNow, decideRequest, listRequests, updateEventRoom, uploadMenu, removeMenu,
  MASTER_PREFIX, type EventRow,
} from "@/lib/gate";
import { downloadQrJpg } from "@/lib/qrimage";

export function EventExtras({ event }: { event: EventRow }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [mErr, setMErr] = useState<string | null>(null);
  const [room, setRoom] = useState(event.room ?? "");
  const saveRoom = useMutation({
    mutationFn: () => updateEventRoom(event.id, room.trim()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
  const close = useMutation({
    mutationFn: () => closeEventNow(event.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  const [menuErr, setMenuErr] = useState<string | null>(null);
  const upMenu = useMutation({
    mutationFn: (f: File) => uploadMenu(event.id, f),
    onSuccess: () => { setMenuErr(null); qc.invalidateQueries({ queryKey: ["events"] }); },
    onError: (e: Error) => setMenuErr(e.message),
  });
  const rmMenu = useMutation({
    mutationFn: () => removeMenu(event.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
  const setMenu = useMutation({
    mutationFn: (path: string) => setEventMenu(event.id, path),
    onSuccess: () => { setMenuErr(null); qc.invalidateQueries({ queryKey: ["events"] }); },
    onError: (e: Error) => setMenuErr(e.message),
  });
  const media = useQuery({ queryKey: ["media"], queryFn: listMedia });
  const menuFiles = (media.data ?? []).filter((m) => {
    const k = kind(m.mime, m.path);
    return k === "image" || k === "pdf";
  });

  return (
    <div className="space-y-5 border-t border-border pt-5">
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><UtensilsCrossed className="size-4 text-primary" /> Menu / carte du restaurant</p>
        <p className="mb-2 text-sm text-muted-foreground">
          {event.menu_path ? "Menu en ligne : l'invité le voit en scannant son QR code avec son téléphone." : "Aucun menu. Choisissez un fichier de la médiathèque ou envoyez une image / un PDF (10 Mo max)."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/70">
            <Upload className="size-3.5" /> Uploader un fichier
            <input type="file" accept="image/*,application/pdf" className="hidden" disabled={upMenu.isPending}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upMenu.mutate(f); e.target.value = ""; }} />
          </label>
          {menuFiles.length > 0 && (
            <select className="field-input max-w-64" value="" disabled={setMenu.isPending}
              onChange={(e) => { const p = e.target.value; if (p) setMenu.mutate(p); }}>
              <option value="">Choisir dans la médiathèque…</option>
              {menuFiles.map((m) => <option key={m.id} value={m.path}>{m.name}</option>)}
            </select>
          )}
          {event.menu_path && <Button variant="ghost" size="sm" className="text-rose" onClick={() => rmMenu.mutate()}>Retirer le menu</Button>}
        </div>
        {upMenu.isPending && <p className="mt-1 text-sm text-muted-foreground">Envoi…</p>}
        {setMenu.isPending && <p className="mt-1 text-sm text-muted-foreground">Application du menu…</p>}
        {menuErr && <p className="mt-1 text-sm text-rose">{menuErr}</p>}
      </div>
      <div>
        <p className="field-label mb-1">Salle</p>
        <div className="flex gap-2">
          <input className="field-input" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="ex : Dar Zmen" />
          <Button variant="outline" onClick={() => saveRoom.mutate()} disabled={saveRoom.isPending}>Enregistrer</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-md bg-paper p-2"><QRCodeSVG value={MASTER_PREFIX + event.id} size={96} /></div>
        <div className="text-sm">
          <p className="font-semibold">QR code maître de l'événement</p>
          <p className="text-muted-foreground">À scanner par un agent pour configurer son terminal sur « {event.title} »{event.room ? ` — ${event.room}` : ""}. Il ne donne pas accès à l'entrée.</p>
          <Button variant="ghost" disabled={busy}
            onClick={async () => {
              setMErr(null); setBusy(true);
              try {
                await downloadQrJpg({
                  value: MASTER_PREFIX + event.id,
                  title: event.title,
                  subtitle: [event.room, "QR maître — ne donne pas accès à l'entrée"].filter(Boolean).join(" · "),
                  fileName: `qr-maitre-${event.title}`,
                });
              } catch { setMErr("Téléchargement impossible, réessayez."); }
              finally { setBusy(false); }
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-0 text-sm text-accent hover:underline"
          >
            <Download className="size-3.5" /> Télécharger (JPG)
          </Button>
          {mErr && <p className="mt-1 text-sm text-rose">{mErr}</p>}
        </div>
      </div>

      <Button variant="outline" className="border-rose/40 text-rose" disabled={close.isPending}
        onClick={() => confirm("Clôturer l'événement maintenant ? Les QR codes seront supprimés, seul le rapport restera.") && close.mutate()}>
        <Lock className="size-4" /> Clôturer l'événement
      </Button>
    </div>
  );
}

export function RequestsPanel({ events }: { events: EventRow[] }) {
  const qc = useQueryClient();
  const reqs = useQuery({ queryKey: ["requests"], queryFn: listRequests, refetchInterval: 10000 });
  const decide = useMutation({
    mutationFn: ({ id, ok }: { id: string; ok: boolean }) => decideRequest(id, ok),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["requests"] }); qc.invalidateQueries({ queryKey: ["events"] }); },
  });
  const pending = (reqs.data ?? []).filter((r) => r.status === "pending");
  if (!pending.length) return null;
  return (
    <div className="glass-panel rounded-lg border-amber/40 p-6">
      <h3 className="mb-3 font-display text-lg font-semibold">Demandes hors quota</h3>
      <div className="space-y-2">
        {pending.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="flex-1"><b>+{r.extra}</b> place(s) · {events.find((e) => e.id === r.event_id)?.title ?? "—"}</span>
            <Button size="icon" aria-label="Accepter" onClick={() => decide.mutate({ id: r.id, ok: true })}><Check className="size-4" /></Button>
            <Button size="icon" variant="outline" aria-label="Refuser" onClick={() => decide.mutate({ id: r.id, ok: false })}><X className="size-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
