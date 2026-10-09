import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, FileDown, FileSpreadsheet, Loader2, Plus, Printer } from "lucide-react";
import { Frame } from "@/components/AppShell";
import { TicketQr } from "@/components/ClientTab";
import { inviteAdd, inviteDelete, inviteExtend, inviteGet, inviteImport, type EventRow } from "@/lib/gate";
import { downloadQrPdf } from "@/lib/qrpdf";
import { downloadEventReport } from "@/lib/report";
import { parseParticipants, type ParsedImport } from "@/lib/importer";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Invitation — Securox" },
      { name: "description", content: "Créez les QR codes de vos invités pour votre événement." },
      { property: "og:title", content: "Invitation — Securox" },
      { property: "og:description", content: "Créez les QR codes de vos invités pour votre événement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const key = ["invite", token];
  const q = useQuery({ queryKey: key, queryFn: () => inviteGet(token), retry: false, refetchInterval: 5000 });
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const imp = useMutation({
    mutationFn: () => inviteImport(token, parsed!.rows),
    onSuccess: () => { setParsed(null); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => setErr(e.message),
  });
  const [mode, setMode] = useState<"named" | "batch">("batch");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [count, setCount] = useState(10);
  const [err, setErr] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () =>
      mode === "named" ? inviteAdd(token, first.trim(), last.trim(), 1) : inviteAdd(token, "", "", count),
    onSuccess: () => { setFirst(""); setLast(""); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => setErr(e.message),
  });
  const [more, setMore] = useState(5);
  const [askMore, setAskMore] = useState(false);
  const extend = useMutation({
    mutationFn: () => inviteExtend(token, more),
    onSuccess: () => { setAskMore(false); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => inviteDelete(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  if (q.isLoading) return <Frame><Loader2 className="mx-auto size-6 animate-spin text-accent" /></Frame>;
  if (q.error || !q.data)
    return <Frame><div className="glass-panel rounded-lg p-6 text-sm text-rose">{(q.error as Error)?.message ?? "Lien invalide"}</div></Frame>;

  const ev = q.data;
  const list = ev.attendees;
  const left = ev.max_capacity - list.length;
  const tab = (k: "named" | "batch", label: string) => (
    <Button variant="ghost" type="button" onClick={() => setMode(k)}
      className={`rounded-md px-4 py-1.5 text-sm ${mode === k ? "bg-primary font-semibold text-accent-foreground" : "text-muted-foreground"}`}>
      {label}
    </Button>
  );

  return (
    <Frame>
      <div className="space-y-6">
        <div className="glass-panel rounded-lg p-6 no-print">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold">{ev.title}</h1>
              {ev.room && <p className="text-sm text-muted-foreground">Salle : {ev.room}</p>}
            </div>
            <span className="font-display text-sm">{list.length}<span className="text-muted-foreground">/{ev.max_capacity}</span> QR codes</span>
          </div>
          <div className="mb-4 flex w-fit gap-1 rounded-md border border-border p-1">
            {tab("batch", "Plusieurs codes")}
            {tab("named", "Avec nom")}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setErr(null); add.mutate(); }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
            {mode === "named" ? (
              <>
                <input required maxLength={60} className="field-input" placeholder="Prénom" value={first} onChange={(e) => setFirst(e.target.value)} />
                <input required maxLength={60} className="field-input" placeholder="Nom" value={last} onChange={(e) => setLast(e.target.value)} />
              </>
            ) : (
              <input type="number" min={1} max={Math.max(1, left)} className="field-input sm:col-span-2" value={count}
                onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} />
            )}
            <Button variant="ghost" disabled={add.isPending || left <= 0 || (mode === "named" && (!first.trim() || !last.trim()))}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40">
              {add.isPending && <Loader2 className="size-4 animate-spin" />}
              Générer
            </Button>
          </form>
          <p className="mt-3 text-sm text-muted-foreground">{left > 0 ? `Il reste ${left} QR code(s).` : "Tous les QR codes ont été créés."}</p>
          {ev.extra_capacity > 0 && (
            <p className="mt-2 text-sm text-amber">{ev.extra_capacity} place(s) supplémentaire(s) ajoutée(s) — elles seront facturées.</p>
          )}
          {!askMore ? (
            <Button variant="ghost" type="button" onClick={() => setAskMore(true)} className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold text-accent hover:bg-muted">
              <Plus className="size-4" /> Ajouter des personnes
            </Button>
          ) : (
            <div className="mt-4 rounded-lg border border-amber/40 bg-amber/10 p-4">
              <p className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
                Les places ajoutées au-delà du nombre prévu seront <b>facturées en supplément</b>. Votre demande sera envoyée à l'hôtel pour validation.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input type="number" min={1} max={1000} className="field-input w-28" value={more} onChange={(e) => setMore(Math.max(1, Number(e.target.value) || 1))} />
                <Button variant="ghost" type="button" disabled={extend.isPending} onClick={() => { setErr(null); extend.mutate(); }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40">
                  {extend.isPending && <Loader2 className="size-4 animate-spin" />} J'accepte, demander {more} place(s)
                </Button>
                <Button variant="ghost" type="button" onClick={() => setAskMore(false)} className="px-3 text-sm text-muted-foreground">Annuler</Button>
              </div>
            </div>
          )}
          {ev.pending_requests.map((r) => (
            <p key={r.id} className={`mt-2 text-sm ${r.status === "approved" ? "text-mint" : r.status === "rejected" ? "text-rose" : "text-amber"}`}>
              Demande de {r.extra} place(s) : {r.status === "approved" ? "acceptée" : r.status === "rejected" ? "refusée" : "en attente de validation"}
            </p>
          ))}
          {err && <p className="mt-2 text-sm text-rose">{err}</p>}
        </div>

        <div className="glass-panel rounded-lg p-6 no-print">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><FileSpreadsheet className="size-5 text-primary" /> Importer une liste (Excel / CSV)</h2>
          <p className="mb-3 text-sm text-muted-foreground">Le fichier doit contenir les colonnes « Nom » et « Prénom » (email et téléphone en option).</p>
          <input type="file" accept=".xlsx,.xls,.csv" className="text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0]; setErr(null); setParsed(null);
              if (!f) return;
              try { setParsed(await parseParticipants(f)); } catch (x) { setErr((x as Error).message); }
              e.target.value = "";
            }} />
          {parsed && (
            <div className="mt-4 space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p><b>{parsed.rows.length}</b> participant(s) prêts à importer sur {parsed.total} ligne(s).</p>
              {parsed.duplicates.length > 0 && <p className="text-amber">Doublons ignorés (lignes {parsed.duplicates.join(", ")})</p>}
              {parsed.missing.length > 0 && <p className="text-rose">Nom ou prénom manquant (lignes {parsed.missing.join(", ")})</p>}
              {parsed.rows.length > left && <p className="text-rose">Trop de participants : il reste {left} QR code(s).</p>}
              <div className="max-h-40 overflow-auto font-mono text-xs text-muted-foreground">
                {parsed.rows.slice(0, 50).map((r, i) => <div key={i}>{r.first} {r.last}{r.email ? ` · ${r.email}` : ""}</div>)}
              </div>
              <div className="flex gap-2">
                <Button disabled={imp.isPending || !parsed.rows.length || parsed.rows.length > left} onClick={() => imp.mutate()}>
                  {imp.isPending && <Loader2 className="size-4 animate-spin" />} Valider l'import et générer les QR codes
                </Button>
                <Button variant="ghost" onClick={() => setParsed(null)}>Annuler</Button>
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel rounded-lg p-6 no-print">
          <h2 className="mb-3 font-display text-lg font-semibold">Présences en direct</h2>
          <p className="font-display text-3xl font-bold">{ev.current_count}<span className="text-base text-muted-foreground"> / {list.length} invités entrés</span></p>
          <Button variant="outline" className="mt-4" onClick={() => downloadEventReport({
            id: ev.id, title: ev.title, date: ev.date, end_date: ev.end_date, max_capacity: ev.max_capacity,
            extra_capacity: ev.extra_capacity, current_count: ev.current_count, created_at: ev.date, client_id: null,
            invite_token: token, closed_at: null, report: null, room: ev.room,
          } as EventRow, list.map((a) => ({ ...a, event_id: ev.id, created_at: ev.date })))}>
            <FileDown className="size-4" /> Rapport de présence (PDF)
          </Button>
        </div>

        <div className="glass-panel rounded-lg p-6 print-area">
          <div className="mb-4 flex justify-end gap-2">
            <Button variant="outline" className="no-print" disabled={!list.length}
              onClick={() => downloadQrPdf(ev.title, ev.room, list.map((t, i) => ({ code: t.ticket_code, name: t.guest_name || `Invité n°${i + 1}` })))}>
              <FileDown className="size-4" /> Tous les QR codes (PDF)
            </Button>
            <Button variant="ghost" onClick={() => window.print()} className="text-accent no-print" aria-label="Imprimer"><Printer className="size-4" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {list.map((t, i) => (
              <TicketQr key={t.id} code={t.ticket_code}
                guestName={t.guest_name || `Invité n°${i + 1}`}
                status={t.status} onRemove={() => remove.mutate(t.id)} />
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}
