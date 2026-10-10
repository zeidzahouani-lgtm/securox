import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { listAttendees, listEvents, listSessions, scanTicketV2, MASTER_PREFIX, extractTicket, type ScanResult } from "@/lib/gate";
import { useLiveGate } from "@/lib/realtime";

type Feed = { code: string; ok: boolean; label: string; at: string };

export function ScannerTab() {
  const qc = useQueryClient();
  useLiveGate();
  const events = useQuery({ queryKey: ["events"], queryFn: listEvents });
  const [eventId, setEventId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [last, setLast] = useState<ScanResult | null>(null);
  const [pending, setPending] = useState<ScanResult | null>(null);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const sessions = useQuery({ queryKey: ["sessions", eventId], queryFn: () => listSessions(eventId!), enabled: !!eventId });
  useEffect(() => {
    const now = Date.now();
    const cur = sessions.data?.find((x) => new Date(x.starts_at).getTime() <= now && now <= new Date(x.ends_at).getTime());
    setSessionId(cur?.id ?? "");
  }, [sessions.data]);
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
  const live = useQuery({ queryKey: ["attendees", eventId], queryFn: () => listAttendees(eventId!), enabled: !!eventId });
  const entered = (live.data ?? []).filter((a) => a.checked_in_at).sort((a, b) => b.checked_in_at!.localeCompare(a.checked_in_at!));
  const overLimit = entered.filter((a) => a.status === "Over-limit").length;
  const nowMs = Date.now();
  const buckets = Array.from({ length: 12 }, (_, i) =>
    entered.filter((a) => { const d = nowMs - new Date(a.checked_in_at!).getTime(); return d >= (11 - i) * 300_000 && d < (12 - i) * 300_000; }).length);
  const maxB = Math.max(1, ...buckets);
  const lastHour = buckets.reduce((x, y) => x + y, 0);

  const scan = useMutation({
    mutationFn: ({ ticket, force }: { ticket: string; force: boolean }) =>
      scanTicketV2(ticket, eventId!, force, sessionId || null, "Scanner"),
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
                ? "Entré"
                : res.result === "granted_over"
                  ? "Entré (hors quota)"
                  : res.result === "already" || res.result === "duplicate_session"
                    ? "Doublon"
                    : res.result === "wrong_event"
                      ? "Mauvais événement"
                      : res.result === "off_session"
                        ? "Hors session"
                        : "Code invalide",
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
    const ticket = extractTicket(value);
    if (!ticket) return;
    if (ticket.startsWith(MASTER_PREFIX)) {
      const id = ticket.slice(MASTER_PREFIX.length);
      const ev = events.data?.find((e) => e.id === id);
      setCode("");
      setNotice(ev ? `Terminal configuré sur « ${ev.title} »${ev.room ? ` — ${ev.room}` : ""}` : "QR maître inconnu");
      if (ev) { setEventId(ev.id); setSessionId(""); }
      return;
    }
    if (!eventId) return;
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
        <div className="glass-panel rounded-lg p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold">Scanner d'entrée</h3>
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-mint">
              <span className="size-2 animate-softpulse rounded-full bg-mint" />
              Live
            </span>
          </div>

          <select
            className="field-input mb-4"
            value={eventId ?? ""}
            onChange={(e) => { setEventId(e.target.value); setSessionId(""); }}
          >
            {events.data?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}{e.room ? ` — ${e.room}` : ""}
              </option>
            ))}
          </select>
          {!!sessions.data?.length && (
            <select className="field-input mb-4" value={sessionId} onChange={(e) => setSessionId(e.target.value)} aria-label="Session">
              <option value="">Entrée générale (sans session)</option>
              {sessions.data.map((x) => <option key={x.id} value={x.id}>{x.name} · {new Date(x.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}–{new Date(x.ends_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</option>)}
            </select>
          )}
          {notice && <p className="mb-4 rounded-md border border-mint/40 bg-mint/10 px-3 py-2 text-sm text-mint">{notice}</p>}

          <div className="relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-border bg-muted/40">
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
              Scannez un QR code
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              className="field-input font-mono"
              placeholder="Scanner ou saisir un code…"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(code)}
            />
            <Button variant="ghost"
              onClick={() => submit(code)}
              className="whitespace-nowrap rounded-md bg-primary px-5 py-3 font-display text-sm font-semibold text-accent-foreground"
            >
              Valider
            </Button>
            <Button variant="ghost"
              onClick={() => setCameraOn((v) => !v)}
              className="rounded-md border border-border p-3 text-muted-foreground"
              aria-label="Toggle camera"
            >
              {cameraOn ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
            </Button>
          </div>

          <div className="mt-4">
            <input className="field-input" placeholder="Recherche de secours par nom / prénom…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search.trim().length >= 2 && (
              <div className="mt-2 max-h-48 space-y-1 overflow-auto">
                {(live.data ?? []).filter((a) => (a.guest_name ?? "").toLowerCase().includes(search.trim().toLowerCase())).slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
                    <span className="flex-1">{a.guest_name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{a.ticket_code}</span>
                    <Button size="sm" onClick={() => { lastScanRef.current = null; submit(a.ticket_code); setSearch(""); }}>Valider</Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {last && (
            <div
              key={last.ticket_code + String(last.result) + String(last.current_count)}
              className={`mt-4 animate-slam rounded-lg border px-4 py-3 ${
                granted ? "border-mint/40 bg-mint/10" : "border-rose/40 bg-rose/10"
              }`}
            >
              <p
                className={`font-display text-xl font-bold tracking-wide ${granted ? "text-mint" : "text-rose"}`}
              >
                {last.result === "granted"
                  ? "ACCÈS AUTORISÉ"
                  : last.result === "granted_over"
                    ? "ENTRÉ · HORS QUOTA"
                    : last.result === "already"
                      ? "DOUBLON · CODE DÉJÀ UTILISÉ"
                      : last.result === "duplicate_session"
                        ? `DOUBLON · DÉJÀ SCANNÉ (${last.session ?? "session"})`
                        : last.result === "wrong_event"
                          ? "CE QR CODE APPARTIENT À UN AUTRE ÉVÉNEMENT"
                          : last.result === "off_session"
                            ? `HORS SESSION (${last.session ?? ""})`
                            : "CODE INVALIDE"}
              </p>
              {last.result === "wrong_event" && (
                <p className="mt-1 text-sm font-semibold text-rose">
                  Événement attendu : {last.expected_event ?? "—"}{last.expected_room ? ` — Salle : ${last.expected_room}` : ""}
                </p>
              )}
              {granted && last.session && <p className="mt-1 text-sm text-mint">Session : {last.session}</p>}
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {last.ticket_code ?? "—"} {last.guest_name ? `· ${last.guest_name}` : ""}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-6 space-y-6">
        <div className="glass-panel rounded-lg p-6">
          <div className="mb-2 flex items-end justify-between">
            <span className="field-label">Remplissage</span>
            <span className="font-display text-3xl font-bold">
              {inside}
              <span className="text-base text-muted-foreground/60">/{capacity}</span>
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-md border border-border bg-muted/50 p-4">
              <p className="field-label">Présents</p>
              <p className="font-display text-3xl font-bold text-mint">{inside}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/50 p-4">
              <p className="field-label">Capacité</p>
              <p className="font-display text-3xl font-bold">{capacity}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/50 p-4">
              <p className="field-label">Restant</p>
              <p className="font-display text-3xl font-bold text-amber">{remaining}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-lg p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="field-label">Entrées · 60 dernières minutes</p>
            <span className="font-display text-sm"><span className="text-mint">{lastHour}</span> entrées · <span className="text-amber">{overLimit}</span> hors quota</span>
          </div>
          <div className="flex h-28 items-end gap-1.5">
            {buckets.map((b, i) => (
              <div key={i} className="flex-1 rounded-t-md bg-primary transition-[height] duration-500"
                style={{ height: `${Math.max(4, (b / maxB) * 100)}%`, opacity: b ? 1 : 0.25 }} title={`${b} entrée(s)`} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>-60 min</span><span>maintenant</span></div>
        </div>

        <div className="glass-panel rounded-lg p-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="field-label">Flux en direct · tous les scanners</p>
            <span className="flex items-center gap-1.5 text-[11px] text-mint"><span className="size-2 animate-softpulse rounded-full bg-mint" />Temps réel</span>
          </div>
          <div className="max-h-64 space-y-1.5 overflow-auto">
            {entered.slice(0, 30).map((a) => (
              <div key={a.id} className="flex animate-slam items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                <span className={`size-2 rounded-full ${a.status === "Over-limit" ? "bg-amber" : "bg-mint"}`} />
                <span className="text-sm font-medium">{a.guest_name || "Invité"}</span>
                <span className="font-mono text-xs text-muted-foreground">{a.ticket_code}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{new Date(a.checked_in_at!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              </div>
            ))}
            {!entered.length && <p className="text-sm text-muted-foreground">Aucune entrée pour l'instant.</p>}
          </div>
        </div>

        <div className="glass-panel rounded-lg p-6">
          <p className="field-label mb-3">Mes scans</p>
          <div className="space-y-2">
            {feed.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`size-1.5 rounded-full ${f.ok ? "bg-mint" : "bg-rose"}`} />
                <span className="font-mono text-xs">{f.code}</span>
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{f.at}</span>
              </div>
            ))}
            {!feed.length && <p className="text-sm text-muted-foreground">Aucun scan.</p>}
          </div>
        </div>
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 grid place-items-center p-6">
          <div className="absolute inset-0 bg-background/80" />
          <div className="relative w-full max-w-md animate-slam rounded-lg border border-rose/40 bg-gradient-to-br from-rose/15 to-amber/10 p-6 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2 animate-softpulse rounded-full bg-rose" />
              <p className="font-display font-semibold text-rose">
                ⚠️ Capacité maximale atteinte ! ({pending.current_count}/{pending.max_capacity})
              </p>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              Le code <span className="font-mono text-foreground">{pending.ticket_code}</span>
              {pending.guest_name ? ` · ${pending.guest_name}` : ""} a été scanné au-delà de la capacité prévue. Que faire ?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost"
                onClick={() => scan.mutate({ ticket: pending.ticket_code!, force: true })}
                className="rounded-md bg-primary py-3 font-display text-sm font-semibold text-accent-foreground"
              >
                Accepter et facturer
              </Button>
              <Button variant="ghost"
                onClick={() => {
                  setFeed((f) =>
                    [
                      {
                        code: pending.ticket_code ?? "",
                        ok: false,
                        label: "Refusé",
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
                className="rounded-md border border-rose/40 py-3 font-display text-sm font-semibold text-rose"
              >
                Ne pas laisser
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
