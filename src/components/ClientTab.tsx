import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Loader2, Printer, Trash2 } from "lucide-react";
import { addAttendee, deleteAttendee, listAttendees, listEvents } from "@/lib/gate";

export function ClientTab({ initialEventId }: { initialEventId?: string | null }) {
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ["events"], queryFn: listEvents });
  const [eventId, setEventId] = useState<string | null>(initialEventId ?? null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId && events.data?.length) setEventId(events.data[0]!.id);
  }, [events.data, eventId]);

  const event = events.data?.find((e) => e.id === eventId) ?? null;
  const attendees = useQuery({
    queryKey: ["attendees", eventId],
    queryFn: () => listAttendees(eventId!),
    enabled: !!eventId,
  });
  const list = attendees.data ?? [];
  const full = event ? list.length >= event.max_capacity : true;

  const add = useMutation({
    mutationFn: () => addAttendee(eventId!, first.trim(), last.trim()),
    onSuccess: () => {
      setFirst("");
      setLast("");
      qc.invalidateQueries({ queryKey: ["attendees", eventId] });
    },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteAttendee,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendees", eventId] }),
  });

  if (!events.isLoading && !events.data?.length) {
    return (
      <div className="glass-panel rounded-3xl p-6 text-sm text-muted-foreground">
        Aucun événement. Ouvrez le lien envoyé par l'organisateur pour y accéder.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-3xl p-6 no-print">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <select className="field-input w-auto" value={eventId ?? ""} onChange={(e) => setEventId(e.target.value)}>
            {events.data?.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          {event && (
            <span className="font-display text-sm">
              {list.length}<span className="text-white/30">/{event.max_capacity}</span> QR codes
            </span>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            add.mutate();
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input required maxLength={60} className="field-input" placeholder="Prénom" value={first} onChange={(e) => setFirst(e.target.value)} />
          <input required maxLength={60} className="field-input" placeholder="Nom" value={last} onChange={(e) => setLast(e.target.value)} />
          <button disabled={add.isPending || full || !first.trim() || !last.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent2 px-6 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40">
            {add.isPending && <Loader2 className="size-4 animate-spin" />}
            Générer le QR code
          </button>
        </form>
        {full && event && <p className="mt-3 text-sm text-amber">Tous les QR codes disponibles ont été créés.</p>}
        {err && <p className="mt-3 text-sm text-rose">{err}</p>}
      </div>

      <div className="glass-panel rounded-3xl p-6 print-area">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">{event?.title}</h3>
          <button onClick={() => window.print()} className="text-accent no-print" aria-label="Imprimer">
            <Printer className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {list.map((t) => (
            <div key={t.id} className="rounded-2xl border border-white/10 bg-ink/40 p-3">
              <div className="mb-2 grid aspect-square place-items-center rounded-lg bg-white">
                <QRCodeSVG value={t.ticket_code} size={110} />
              </div>
              <p className="font-semibold">{t.first_name} {t.last_name}</p>
              <p className="font-mono text-[11px] text-white/60">{t.ticket_code}</p>
              {t.status === "Pending" && (
                <button onClick={() => remove.mutate(t.id)} className="mt-2 text-rose no-print" aria-label="Supprimer">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
