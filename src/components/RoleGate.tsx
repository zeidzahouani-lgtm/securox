import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowUpRight, Loader2, QrCode, ScanLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pinLogin } from "@/lib/pin.functions";

type Pick = "admin" | "scanner" | "client" | null;

const CARDS = [
  { k: "admin", icon: ShieldCheck, title: "Admin", desc: "Créer les événements, suivre les entrées, rapports PDF." },
  { k: "scanner", icon: ScanLine, title: "Scanner", desc: "Contrôler l'accès à l'entrée avec compteur en direct." },
  { k: "client", icon: QrCode, title: "Client", desc: "Générer les QR codes de vos invités via votre lien." },
] as const;

export function RoleGate() {
  const [pick, setPick] = useState<Pick>(null);
  const [pin, setPin] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const login = useServerFn(pinLogin);
  const navigate = useNavigate();
  const ActiveIcon = pick ? CARDS.find((c) => c.k === pick)!.icon : null;

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (pick !== "admin" && pick !== "scanner") return;
    setBusy(true); setErr(null);
    try {
      const r = await login({ data: { role: pick, pin } });
      if (r.error || !("access_token" in r)) { setErr(r.error ?? "Erreur"); return; }
      if (!r.access_token || !r.refresh_token) { setErr("Accès indisponible"); return; }
      await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
    } catch { setErr("Code PIN invalide"); }
    finally { setBusy(false); setPin(""); }
  }

  function openLink(e: React.FormEvent) {
    e.preventDefault();
    const t = link.trim().split("/invite/").pop()?.split(/[?#/]/)[0];
    if (t) navigate({ to: "/invite/$token", params: { token: t } });
  }

  if (!pick) {
    return (
      <div className="mx-auto max-w-5xl py-6 md:py-14">
        <div className="mb-10 border-l-4 border-primary pl-5">
          <p className="mb-3 font-mono text-xs font-semibold text-primary">SECUROX</p>
          <h1 className="font-display text-4xl font-bold md:text-5xl">Vos espaces<span className="text-primary">.</span></h1>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {CARDS.map(({ k, icon: Icon, title }, i) => (
            <Button variant="outline" key={k} onClick={() => setPick(k)}
              className="group relative flex h-64 flex-col items-start justify-between whitespace-normal border-border bg-card p-6 text-left text-foreground hover:border-primary hover:bg-primary/5 hover:text-foreground">
              <div className="flex w-full items-start justify-between">
                <Icon className="!size-28 text-primary" strokeWidth={1.4} />
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <div className="flex w-full items-center justify-between border-t border-border pt-5"><span className="font-display text-2xl font-semibold">{title}</span><ArrowUpRight className="size-5 text-primary transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" /></div>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 max-w-sm border-t-4 border-primary bg-card p-8 shadow-sm">
      <Button variant="ghost" onClick={() => { setPick(null); setErr(null); }} className="mb-6 px-0 text-muted-foreground">
        <ArrowLeft className="size-4" /> Retour
      </Button>
      {pick === "client" ? (
        <form onSubmit={openLink} className="space-y-4">
          {ActiveIcon && <ActiveIcon className="size-24 text-primary" strokeWidth={1.4} />}
          <h2 className="font-display text-2xl font-bold">Espace client</h2>
          <p className="text-sm text-muted-foreground">Collez le lien reçu de l'organisateur.</p>
          <input required className="field-input" placeholder="https://…/invite/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <Button type="submit" className="h-12 w-full font-semibold">Ouvrir</Button>
        </form>
      ) : (
        <form onSubmit={submitPin} className="space-y-4">
          {ActiveIcon && <ActiveIcon className="size-24 text-primary" strokeWidth={1.4} />}
          <h2 className="font-display text-2xl font-bold">{pick === "admin" ? "Admin" : "Scanner"}</h2>
          <p className="text-sm text-muted-foreground">Entrez le code PIN.</p>
          <input autoFocus inputMode="numeric" type="password" maxLength={8} required
            className="field-input text-center font-mono text-2xl" aria-label="Code PIN"
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          {err && <p className="text-sm text-rose">{err}</p>}
          <Button type="submit" disabled={busy || pin.length < 4}
            className="h-12 w-full font-semibold">
            {busy && <Loader2 className="size-4 animate-spin" />} Entrer
          </Button>
        </form>
      )}
    </div>
  );
}
