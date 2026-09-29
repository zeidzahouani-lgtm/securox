import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Printer, Download, Loader2 } from "lucide-react";
import {
  createEventWithTickets,
  listAttendees,
  listEvents,
  renameGuest,
  type EventRow,
} from "@/lib/gate";

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Checked-in"
      ? "bg-mint/15 text-mint"
      : status === "Over-limit"
        ? "bg-amber/15 text-amber"
        : "bg-white/10 text-white/60";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  );
}

export function EventsTab() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [capacity, setCapacity] = useState(250);
  const [batchSize, setBatchSize] = useState(250);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const events = useQuery({ queryKey: ["events"], queryFn: listEvents });

  useEffect(() => {
    if (!selectedId && events.data?.length) setSelectedId(events.data[0]!.id);
  }, [events.data, selectedId]);

  const attendees = useQuery({
    queryKey: ["attendees", selectedId],
    queryFn: () => listAttendees(selectedId!),
    enabled: !!selectedId,
  });

  const create = useMutation({
    mutationFn: createEventWithTickets,
    onSuccess: (event: EventRow) => {
      setSelectedId(event.id);
      setTitle("");
      setDate("");
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameGuest(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendees", selectedId] }),
  });

  const selected = events.data?.find((e) => e.id === selectedId) ?? null;
  const tickets = attendees.data ?? [];
  const redeemed = tickets.filter((t) => t.status !== "Pending").length;

  function downloadCodes() {
    if (!selected) return;
    const csv = [
      "ticket_code,guest_name,status",
      ...tickets.map((t) => `${t.ticket_code},${t.guest_name ?? ""},${t.status}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.title.replace(/\s+/g, "-").toLowerCase()}-tickets.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7 space-y-6">
        <div className="glass-panel rounded-3xl p-6 no-print">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold tracking-tight">New Event</h2>
            <span className="text-[11px] uppercase tracking-[0.2em] text-accent">Draft</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="field-label">Event name</label>
              <input
                className="field-input mt-1"
                placeholder="Neon Nights — Rooftop Set"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Date &amp; time</label>
              <input
                type="datetime-local"
                className="field-input mt-1"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Capacity</label>
              <input
                type="number"
                min={1}
                className="field-input mt-1"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="field-label">QR batch size</label>
              <input
                type="number"
                min={1}
                className="field-input mt-1"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
              />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-rose">{error}</p>}
          <div className="mt-5 flex items-center gap-3">
            <button
              disabled={create.isPending || !title || !date}
              onClick={() => {
                setError(null);
                create.mutate({ title, date, capacity, batchSize });
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent2 px-6 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40"
            >
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Generate QR Tickets
            </button>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 print-area">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">
              QR Ticket Batch{selected ? ` — ${selected.title}` : ""}
            </h3>
            <div className="flex items-center gap-3 no-print">
              <span className="text-xs text-muted-foreground">
                {tickets.length} generated · {redeemed} redeemed
              </span>
              <button onClick={downloadCodes} className="text-accent" aria-label="Download codes">
                <Download className="size-4" />
              </button>
              <button onClick={() => window.print()} className="text-accent" aria-label="Print grid">
                <Printer className="size-4" />
              </button>
            </div>
          </div>
          {!tickets.length && (
            <p className="text-sm text-muted-foreground">
              Create an event to mint its ticket batch.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {tickets.slice(0, 120).map((t) => (
              <div key={t.id} className="rounded-2xl border border-white/10 bg-ink/40 p-3">
                <div className="mb-2 grid aspect-square place-items-center rounded-lg bg-white">
                  <QRCodeSVG value={t.ticket_code} size={96} />
                </div>
                <p className="font-mono text-[11px] text-white/60">{t.ticket_code}</p>
                <input
                  className="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-white/30"
                  placeholder="Guest name"
                  defaultValue={t.guest_name ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (t.guest_name ?? "")) {
                      rename.mutate({ id: t.id, name: e.target.value });
                    }
                  }}
                />
                <div className="mt-2">
                  <StatusBadge status={t.status} />
                </div>
              </div>
            ))}
          </div>
          {tickets.length > 120 && (
            <p className="mt-4 text-xs text-muted-foreground">
              Showing first 120 of {tickets.length} tickets.
            </p>
          )}
        </div>
      </div>

      <div className="lg:col-span-5 no-print">
        <div className="glass-panel rounded-3xl p-6">
          <h3 className="mb-4 font-display text-lg font-semibold">Events</h3>
          <div className="space-y-2">
            {events.data?.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  e.id === selectedId
                    ? "border-accent/50 bg-accent/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{e.title}</span>
                  <span className="font-display text-sm">
                    {e.current_count}
                    <span className="text-white/30">/{e.max_capacity}</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(e.date).toLocaleString()}
                </p>
              </button>
            ))}
            {!events.data?.length && !events.isLoading && (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
