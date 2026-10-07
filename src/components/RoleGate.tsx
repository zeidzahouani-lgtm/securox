import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, QrCode, ScanLine, ShieldCheck } from "lucide-react";
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

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (pick !== "admin" && pick !== "scanner") return;
    setBusy(true); setErr(null);
    try {
      const r = await login({ data: { role: pick, pin } });
      if (r.error || !("access_token" in r)) { setErr(r.error ?? "Erreur"); return; }
      await supabase.auth.setSession({ access_token: r.access_token!, refresh_token: r.refresh_token! });
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
      <div className="mx-auto mt-10 max-w-4xl">
        <h1 className="text-center font-display text-4xl font-bold tracking-tight md:text-5xl">
          Contrôle d'accès <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">en temps réel</span>
        </h1>
        <p className="mt-3 text-center text-muted-foreground">Choisissez votre espace pour continuer.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {CARDS.map(({ k, icon: Icon, title, desc }) => (
            <button key={k} onClick={() => setPick(k)}
              className="group glass-panel rounded-3xl p-6 text-left transition hover:-translate-y-1 hover:border-accent/50">
              <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent2 text-accent-foreground">
                <Icon className="size-6" />
              </span>
              <p className="mt-5 font-display text-xl font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-sm glass-panel rounded-3xl p-8">
      <button onClick={() => { setPick(null); setErr(null); }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Retour
      </button>
      {pick === "client" ? (
        <form onSubmit={openLink} className="space-y-4">
          <h2 className="font-display text-2xl font-bold">Espace client</h2>
          <p className="text-sm text-muted-foreground">Collez le lien reçu de l'organisateur.</p>
          <input required className="field-input" placeholder="https://…/invite/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <button className="w-full rounded-xl bg-gradient-to-r from-accent to-accent2 py-3 font-display text-sm font-semibold text-accent-foreground">Ouvrir</button>
        </form>
      ) : (
        <form onSubmit={submitPin} className="space-y-4">
          <h2 className="font-display text-2xl font-bold">{pick === "admin" ? "Admin" : "Scanner"}</h2>
          <p className="text-sm text-muted-foreground">Entrez le code PIN.</p>
          <input autoFocus inputMode="numeric" type="password" maxLength={8} required
            className="field-input text-center font-mono text-2xl tracking-[0.5em]"
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          {err && <p className="text-sm text-rose">{err}</p>}
          <button disabled={busy || pin.length < 4}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent2 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40">
            {busy && <Loader2 className="size-4 animate-spin" />} Entrer
          </button>
        </form>
      )}
    </div>
  );
}
