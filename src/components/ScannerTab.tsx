import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { listEvents, scanTicket, type ScanResult } from "@/lib/gate";

type Feed = { code: string; ok: boolean; label: string; at: string };

export function ScannerTab() {
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ["events"], queryFn: listEvents });
  const [eventId, setEventId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [last, setLast] = useState<ScanResult | null>(null);
  const [pending, setPending] = useState<ScanResult | null>(null);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  useEffect(() => {
    if (!eventId && events.data?.length) setEventId(events.data[0]!.id);
  }, [events.data, eventId]);

  const selected = events.data?.find((e) => e.id === eventId) ?? null;
  const inside = selected?.current_count ?? 0;
  const capacity = selected?.max_capacity ?? 0;
  const remaining = Math.max(0, capacity - inside);
  const pct = capacity ? Math.min(100, (inside / capacity) * 100) : 0;

  const scan = useMutation({
    mutationFn: ({ ticket, force }: { ticket: string; force: boolean }) =>
      scanTicket(ticket, eventId!, force),
    onSuccess: (res) => {
      if (res.result === "over_capacity") {
        setPending(res);
        return;
      }
      setLast(res);
      setPending(null);
      const granted = res.result === "granted" || res.result === "granted_over";
      setFeed((f) =>
        [
          {
            code: res.ticket_code ?? code,
            ok: granted,
            label:
              res.result === "granted"
                ? "Admitted"
                : res.result === "granted_over"
                  ? "Over-limit admitted"
                  : res.result === "already"
                    ? "Already used"
                    : "Invalid ticket",
            at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
          ...f,
        ].slice(0, 8),
      );
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["attendees", eventId] });
    },
  });

  function submit(value: string) {
    const ticket = value.trim();
    if (!ticket || !eventId) return;
    const now = Date.now();
    const prev = lastScanRef.current;
    // Ignore the same code scanned again within 4 seconds (camera reads continuously)
    if (prev && prev.code === ticket.toUpperCase() && now - prev.at < 4000) return;
    lastScanRef.current = { code: ticket.toUpperCase(), at: now };
    setCode("");
    scan.mutate({ ticket, force: false });
  }

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    let instance: any = null;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      instance = new Html5Qrcode("qr-camera");
      scannerRef.current = instance;
      try {
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (decoded: string) => submit(decoded),
          () => {},
        );
      } catch {
        if (!cancelled) setCameraOn(false);
      }
    })();

    return () => {
      cancelled = true;
      if (instance) {
        instance.stop().then(() => instance.clear()).catch(() => {});
      }
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, eventId]);

  const granted = last?.result === "granted" || last?.result === "granted_over";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-6">
        <div className="glass-panel rounded-3xl p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold">Live Door Scanner</h3>
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-mint">
              <span className="size-2 animate-softpulse rounded-full bg-mint" />
              Live
            </span>
          </div>

          <select
            className="field-input mb-4"
            value={eventId ?? ""}
            onChange={(e) => setEventId(e.target.value)}
          >
            {events.data?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>

          <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-border bg-muted/40">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/10 to-transparent" />
            {!cameraOn && (
              <div className="pointer-events-none absolute inset-x-0 h-16 animate-scanline bg-gradient-to-b from-transparent via-accent/40 to-transparent" />
            )}
            <div id="qr-camera" className="size-full" />
            {!cameraOn && (
              <div className="absolute inset-0 grid place-items-center">
                <ScanLine className="size-16 text-muted-foreground/40" />
              </div>
            )}
            <span className="absolute bottom-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Scan to admit
            </span>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <input
              className="field-input font-mono"
              placeholder="Scan or type ticket code…"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(code)}
            />
            <button
              onClick={() => submit(code)}
              className="whitespace-nowrap rounded-xl bg-gradient-to-r from-accent to-accent2 px-5 py-3 font-display text-sm font-semibold text-accent-foreground"
            >
              Check in
            </button>
            <button
              onClick={() => setCameraOn((v) => !v)}
              className="rounded-xl border border-border p-3 text-muted-foreground"
              aria-label="Toggle camera"
            >
              {cameraOn ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
            </button>
          </div>

          {last && (
            <div
              key={last.ticket_code + String(last.result) + String(last.current_count)}
              className={`mt-4 animate-slam rounded-2xl border px-4 py-3 ${
                granted ? "border-mint/40 bg-mint/10" : "border-rose/40 bg-rose/10"
              }`}
            >
              <p
                className={`font-display text-xl font-bold tracking-wide ${granted ? "text-mint" : "text-rose"}`}
              >
                {last.result === "granted"
                  ? "ACCESS GRANTED"
                  : last.result === "granted_over"
                    ? "ADMITTED · OVER-LIMIT"
                    : last.result === "already"
                      ? "TICKET ALREADY USED"
                      : "INVALID TICKET"}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {last.ticket_code ?? "—"} {last.guest_name ? `· ${last.guest_name}` : ""}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-6 space-y-6">
        <div className="glass-panel rounded-3xl p-6">
          <div className="mb-2 flex items-end justify-between">
            <span className="field-label">Capacity</span>
            <span className="font-display text-3xl font-bold">
              {inside}
              <span className="text-base text-muted-foreground/60">/{capacity}</span>
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <p className="field-label">Inside</p>
              <p className="font-display text-3xl font-bold text-mint">{inside}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <p className="field-label">Capacity</p>
              <p className="font-display text-3xl font-bold">{capacity}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <p className="field-label">Remaining</p>
              <p className="font-display text-3xl font-bold text-amber">{remaining}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <p className="field-label mb-3">Recent scans</p>
          <div className="space-y-2">
            {feed.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`size-1.5 rounded-full ${f.ok ? "bg-mint" : "bg-rose"}`} />
                <span className="font-mono text-xs">{f.code}</span>
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{f.at}</span>
              </div>
            ))}
            {!feed.length && <p className="text-sm text-muted-foreground">No scans yet.</p>}
          </div>
        </div>
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 grid place-items-center p-6">
          <div className="absolute inset-0 bg-background/80" />
          <div className="relative w-full max-w-md animate-slam rounded-3xl border border-rose/40 bg-gradient-to-br from-rose/15 to-amber/10 p-6 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2 animate-softpulse rounded-full bg-rose" />
              <p className="font-display font-semibold text-rose">
                ⚠️ Capacity limit reached! ({pending.current_count}/{pending.max_capacity})
              </p>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              Ticket <span className="font-mono text-foreground">{pending.ticket_code}</span>
              {pending.guest_name ? ` · ${pending.guest_name}` : ""} was scanned beyond the booked
              capacity. Choose how to handle this guest.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => scan.mutate({ ticket: pending.ticket_code!, force: true })}
                className="rounded-xl bg-gradient-to-r from-amber to-rose py-3 font-display text-sm font-semibold text-accent-foreground"
              >
                Accepter et facturer
              </button>
              <button
                onClick={() => {
                  setFeed((f) =>
                    [
                      {
                        code: pending.ticket_code ?? "",
                        ok: false,
                        label: "Entry denied",
                        at: new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      },
                      ...f,
                    ].slice(0, 8),
                  );
                  setPending(null);
                }}
                className="rounded-xl border border-rose/40 py-3 font-display text-sm font-semibold text-rose"
              >
                Ne pas laisser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
