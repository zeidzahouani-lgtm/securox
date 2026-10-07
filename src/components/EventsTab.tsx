import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, FileDown, Loader2, Trash2 } from "lucide-react";
import { downloadEventReport } from "@/lib/report";
import {
  closeEndedEvents,
  createEvent,
  deleteEvent,
  listAssignments,
  listAttendees,
  listEvents,
  listScanners,
  setAssignment,
  type EventRow,
} from "@/lib/gate";
import { useLiveGate } from "@/lib/realtime";

export function EventsTab() {
  const qc = useQueryClient();
  useLiveGate();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [capacity, setCapacity] = useState(100);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      await closeEndedEvents().catch(() => {});
      return listEvents();
    },
  });
  const scanners = useQuery({ queryKey: ["scanners"], queryFn: listScanners });

  useEffect(() => {
    if (!selectedId && events.data?.length) setSelectedId(events.data[0]!.id);
  }, [events.data, selectedId]);

  const selected = events.data?.find((e) => e.id === selectedId) ?? null;

  const attendees = useQuery({
    queryKey: ["attendees", selectedId],
    queryFn: () => listAttendees(selectedId!),
    enabled: !!selectedId,
  });
  const assigned = useQuery({
    queryKey: ["assign", selectedId],
    queryFn: () => listAssignments(selectedId!),
    enabled: !!selectedId,
  });

  const create = useMutation({
    mutationFn: createEvent,
    onSuccess: (e: EventRow) => {
      setSelectedId(e.id);
      setTitle("");
      setDate("");
      setEndDate("");
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const toggle = useMutation({
    mutationFn: ({ uid, on }: { uid: string; on: boolean }) => setAssignment(selectedId!, uid, on),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assign", selectedId] }),
  });

  const link = selected ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${selected.invite_token}` : "";
  const tickets = attendees.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        <div className="glass-panel rounded-3xl p-6">
          <h2 className="mb-5 font-display text-2xl font-bold tracking-tight">Nouvel événement</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="field-label">Nom</label>
              <input className="field-input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Début</label>
              <input type="datetime-local" className="field-input mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Fin</label>
              <input type="datetime-local" className="field-input mt-1" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Nombre de QR codes</label>
              <input type="number" min={1} className="field-input mt-1" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-rose">{error}</p>}
          <button
            disabled={create.isPending || !title || !date || !endDate || capacity < 1}
            onClick={() => {
              setError(null);
              create.mutate({ title, date, endDate, capacity });
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent2 px-6 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40"
          >
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Créer l'événement
          </button>
        </div>

        {selected && (
          <div className="glass-panel space-y-5 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">{selected.title}</h3>
              <button onClick={() => confirm("Supprimer cet événement ?") && remove.mutate(selected.id)} className="text-rose" aria-label="Supprimer">
                <Trash2 className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(selected.date).toLocaleString()} → {selected.end_date ? new Date(selected.end_date).toLocaleString() : "—"}
            </p>
            <button
              onClick={() => downloadEventReport(selected, tickets)}
              className="inline-flex items-center gap-2 rounded-xl border border-accent/40 px-4 py-2 text-sm font-semibold text-accent"
            >
              <FileDown className="size-4" /> Rapport de présence (PDF)
            </button>
            {selected.closed_at ? (
              <p className="rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                Événement terminé le {new Date(selected.closed_at).toLocaleString()} : les QR codes et les accès ont été supprimés. Seul le rapport reste disponible.
              </p>
            ) : (<>
            <div>
              <p className="field-label">Lien à envoyer au client</p>
              <div className="mt-1 flex gap-2">
                <input readOnly className="field-input font-mono text-xs" value={link} />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 text-sm text-accent"
                >
                  <Copy className="size-4" /> {copied ? "Copié" : "Copier"}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {selected.client_id ? "Client associé" : "Aucun client n'a encore ouvert le lien"} · {tickets.length}/{selected.max_capacity} QR codes créés · {selected.current_count} entrées
              </p>
            </div>
            <div>
              <p className="field-label mb-2">Scanners assignés</p>
              {!scanners.data?.length && <p className="text-sm text-muted-foreground">Créez d'abord un scanner dans l'onglet Utilisateurs.</p>}
              <div className="space-y-2">
                {scanners.data?.map((s) => {
                  const on = assigned.data?.includes(s.id) ?? false;
                  return (
                    <label key={s.id} className="flex items-center gap-3 text-sm">
                      <input type="checkbox" checked={on} onChange={() => toggle.mutate({ uid: s.id, on: !on })} />
                      {s.full_name || (s.username ? `@${s.username}` : s.email)}
                    </label>
                  );
                })}
              </div>
            </div>
            </>)}
          </div>
        )}
      </div>

      <div className="lg:col-span-5">
        <div className="glass-panel rounded-3xl p-6">
          <h3 className="mb-4 font-display text-lg font-semibold">Événements</h3>
          <div className="space-y-2">
            {events.data?.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={`w-full rounded-2xl border p-4 text-left ${e.id === selectedId ? "border-accent/50 bg-accent/10" : "border-border bg-muted/50 hover:bg-muted"}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{e.title}</span>
                  <span className="font-display text-sm">
                    {e.current_count}
                    <span className="text-muted-foreground/60">/{e.max_capacity}</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(e.date).toLocaleString()}
                  {e.closed_at && <span className="ml-2 rounded-full bg-muted px-2 py-0.5">Terminé</span>}
                </p>
              </button>
            ))}
            {!events.data?.length && !events.isLoading && <p className="text-sm text-muted-foreground">Aucun événement.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
