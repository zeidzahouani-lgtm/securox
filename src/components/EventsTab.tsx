import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, FileDown, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { downloadEventReport } from "@/lib/report";
import {
  addSession,
  closeEndedEvents,
  createEvent,
  deleteEvent,
  listAttendees,
  listEvents,
  type EventRow,
} from "@/lib/gate";
import { useLiveGate } from "@/lib/realtime";
import { EventExtras, RequestsPanel } from "./EventExtras";
import { downloadQrPdf } from "@/lib/qrpdf";

export function EventsTab() {
  const qc = useQueryClient();
  useLiveGate();
  const [title, setTitle] = useState("");
  const [room, setRoom] = useState("");
  const [day, setDay] = useState("");
  const [endDay, setEndDay] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("23:59");
  const [slots, setSlots] = useState<{ name: string; start: string; end: string }[]>([]);
  const date = day ? `${day}T${startTime}` : "";
  const endDate = (endDay || day) ? `${endDay || day}T${endTime}` : "";
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

  useEffect(() => {
    if (!selectedId && events.data?.length) setSelectedId(events.data[0]!.id);
  }, [events.data, selectedId]);

  const selected = events.data?.find((e) => e.id === selectedId) ?? null;

  const attendees = useQuery({
    queryKey: ["attendees", selectedId],
    queryFn: () => listAttendees(selectedId!),
    enabled: !!selectedId,
  });

  const create = useMutation({
    mutationFn: async (input: Parameters<typeof createEvent>[0]) => {
      for (const sl of slots) if (!sl.name.trim() || sl.end <= sl.start) throw new Error(`Créneau « ${sl.name || "sans nom"} » : l'heure de fin doit être après le début`);
      const ev = await createEvent(input);
      for (const sl of slots) await addSession(ev.id, sl.name.trim(), `${day}T${sl.start}`, `${day}T${sl.end}`);
      return ev;
    },
    onSuccess: (e: EventRow) => {
      setSelectedId(e.id);
      setTitle("");
      setRoom("");
      setDay(""); setEndDay(""); setSlots([]);
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteEvent,
    onError: (e: Error) => alert("Suppression impossible : " + e.message),
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });


  const link = selected ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${selected.invite_token}` : "";
  const tickets = attendees.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        <div className="glass-panel rounded-lg p-6">
          <h2 className="mb-5 font-display text-2xl font-bold ">Nouvel événement</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label">Nom</label>
              <input className="field-input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Salle</label>
              <input className="field-input mt-1" placeholder="ex : Dar Zmen" value={room} onChange={(e) => setRoom(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Date</label>
              <input type="date" className="field-input mt-1" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Date de fin (si plusieurs jours)</label>
              <input type="date" className="field-input mt-1" value={endDay} min={day} onChange={(e) => setEndDay(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Heure de début</label>
              <input type="time" step={900} className="field-input mt-1" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Heure de fin</label>
              <input type="time" step={900} className="field-input mt-1" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Créneaux (le même QR code entre une fois par créneau)</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setSlots((x) => [...x, { name: "Déjeuner", start: "12:00", end: "15:00" }])}><Plus className="size-3.5" /> Déjeuner</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setSlots((x) => [...x, { name: "Dîner", start: "19:00", end: "23:00" }])}><Plus className="size-3.5" /> Dîner</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSlots((x) => [...x, { name: "", start: "09:00", end: "11:00" }])}><Plus className="size-3.5" /> Autre</Button>
              </div>
              {slots.map((sl, i) => (
                <div key={i} className="mt-2 grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                  <input className="field-input" placeholder="Nom du créneau" value={sl.name} onChange={(e) => setSlots((x) => x.map((y, j) => j === i ? { ...y, name: e.target.value } : y))} />
                  <input type="time" step={900} className="field-input w-28" value={sl.start} onChange={(e) => setSlots((x) => x.map((y, j) => j === i ? { ...y, start: e.target.value } : y))} />
                  <input type="time" step={900} className="field-input w-28" value={sl.end} onChange={(e) => setSlots((x) => x.map((y, j) => j === i ? { ...y, end: e.target.value } : y))} />
                  <Button type="button" size="icon" variant="ghost" aria-label="Retirer" onClick={() => setSlots((x) => x.filter((_, j) => j !== i))}><X className="size-4" /></Button>
                </div>
              ))}
            </div>
            <div>
              <label className="field-label">Nombre de QR codes</label>
              <input type="number" min={1} className="field-input mt-1" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-rose">{error}</p>}
          <Button variant="ghost"
            disabled={create.isPending || !title || !date || !endDate || capacity < 1}
            onClick={() => {
              setError(null);
              create.mutate({ title, room, date, endDate, capacity });
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40"
          >
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Créer l'événement
          </Button>
        </div>

        {selected && (
          <div className="glass-panel space-y-5 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">{selected.title}</h3>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-rose" aria-label="Supprimer"><Trash2 className="size-4" /> Supprimer</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer « {selected.title} » ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      L'événement, tous ses QR codes, créneaux et passages seront définitivement supprimés. Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => remove.mutate(selected.id)}>Supprimer définitivement</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(selected.date).toLocaleString()} → {selected.end_date ? new Date(selected.end_date).toLocaleString() : "—"}
            </p>
            <Button variant="ghost"
              onClick={() => downloadEventReport(selected, tickets)}
              className="inline-flex items-center gap-2 rounded-md border border-accent/40 px-4 py-2 text-sm font-semibold text-accent"
            >
              <FileDown className="size-4" /> Rapport de présence (PDF)
            </Button>
            {!selected.closed_at && tickets.length > 0 && (
              <Button variant="outline" className="ml-2"
                onClick={() => downloadQrPdf(selected.title, selected.room, tickets.map((t, i) => ({ code: t.ticket_code, name: t.guest_name || `Invité n°${i + 1}` })))}>
                <FileDown className="size-4" /> Tous les QR codes (PDF)
              </Button>
            )}
            {selected.closed_at ? (
              <p className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                Événement terminé le {new Date(selected.closed_at).toLocaleString()} : les QR codes et les accès ont été supprimés. Seul le rapport reste disponible.
              </p>
            ) : (<>
            <div>
              <p className="field-label">Lien à envoyer au client</p>
              <div className="mt-1 flex gap-2">
                <input readOnly className="field-input font-mono text-xs" value={link} />
                <Button variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 text-sm text-accent"
                >
                  <Copy className="size-4" /> {copied ? "Copié" : "Copier"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {tickets.length > 0 ? "Lien utilisé" : "Lien pas encore utilisé"} · {tickets.length}/{selected.max_capacity} QR codes créés · {selected.current_count} entrée{selected.current_count === 1 ? "" : "s"}{selected.extra_capacity ? ` · +${selected.extra_capacity} places ajoutées par le client (à facturer)` : ""}
              </p>
            </div>
            <EventExtras event={selected} />
            </>)}
          </div>
        )}
      </div>

      <div className="space-y-6 lg:col-span-5">
        <RequestsPanel events={events.data ?? []} />
        <div className="glass-panel rounded-lg p-6">
          <h3 className="mb-4 font-display text-lg font-semibold">Événements</h3>
          <div className="space-y-2">
            {events.data?.map((e) => (
              <Button variant="ghost"
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={`w-full rounded-lg border p-4 text-left ${e.id === selectedId ? "border-accent/50 bg-accent/10" : "border-border bg-muted/50 hover:bg-muted"}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{e.title}</span>
                  <span className="font-display text-sm">
                    {e.current_count}
                    <span className="text-muted-foreground/60">/{e.max_capacity}</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {e.room ? `${e.room} · ` : ""}{new Date(e.date).toLocaleString()}
                  {e.closed_at && <span className="ml-2 rounded-full bg-muted px-2 py-0.5">Terminé</span>}
                </p>
              </Button>
            ))}
            {!events.data?.length && !events.isLoading && <p className="text-sm text-muted-foreground">Aucun événement.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
