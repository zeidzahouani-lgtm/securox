import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Frame } from "@/components/AppShell";
import { TicketQr } from "@/components/ClientTab";
import { inviteAdd, inviteDelete, inviteGet } from "@/lib/gate";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Invitation — Dravox Access" },
      { name: "description", content: "Créez les QR codes de vos invités pour votre événement." },
      { property: "og:title", content: "Invitation — Dravox Access" },
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
  const q = useQuery({ queryKey: key, queryFn: () => inviteGet(token), retry: false });
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
  const remove = useMutation({
    mutationFn: (id: string) => inviteDelete(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  if (q.isLoading) return <Frame><Loader2 className="mx-auto size-6 animate-spin text-accent" /></Frame>;
  if (q.error || !q.data)
    return <Frame><div className="glass-panel rounded-3xl p-6 text-sm text-rose">{(q.error as Error)?.message ?? "Lien invalide"}</div></Frame>;

  const ev = q.data;
  const list = ev.attendees;
  const left = ev.max_capacity - list.length;
  const tab = (k: "named" | "batch", label: string) => (
    <button type="button" onClick={() => setMode(k)}
      className={`rounded-full px-4 py-1.5 text-sm ${mode === k ? "bg-gradient-to-r from-accent to-accent2 font-semibold text-accent-foreground" : "text-muted-foreground"}`}>
      {label}
    </button>
  );

  return (
    <Frame>
      <div className="space-y-6">
        <div className="glass-panel rounded-3xl p-6 no-print">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-xl font-bold">{ev.title}</h1>
            <span className="font-display text-sm">{list.length}<span className="text-muted-foreground">/{ev.max_capacity}</span> QR codes</span>
          </div>
          <div className="mb-4 flex w-fit gap-1 rounded-full border border-border p-1">
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
            <button disabled={add.isPending || left <= 0 || (mode === "named" && (!first.trim() || !last.trim()))}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent2 px-6 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40">
              {add.isPending && <Loader2 className="size-4 animate-spin" />}
              Générer
            </button>
          </form>
          <p className="mt-3 text-sm text-muted-foreground">{left > 0 ? `Il reste ${left} QR code(s).` : "Tous les QR codes ont été créés."}</p>
          {err && <p className="mt-2 text-sm text-rose">{err}</p>}
        </div>

        <div className="glass-panel rounded-3xl p-6 print-area">
          <div className="mb-4 flex justify-end">
            <button onClick={() => window.print()} className="text-accent no-print" aria-label="Imprimer"><Printer className="size-4" /></button>
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
