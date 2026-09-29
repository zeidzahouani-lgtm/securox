import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AuthForm({ subtitle }: { subtitle?: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErr(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.href },
      });
      if (error) setErr(error.message);
      else if (!data.session) setMsg("Vérifiez votre email pour confirmer votre compte.");
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto mt-16 max-w-md glass-panel rounded-3xl p-8">
      <h1 className="font-display text-2xl font-bold">
        {mode === "in" ? "Connexion" : "Créer un compte"}
      </h1>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="field-label">Email</label>
          <input type="email" required className="field-input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Mot de passe</label>
          <input type="password" required minLength={8} className="field-input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-rose">{err}</p>}
        {msg && <p className="text-sm text-mint">{msg}</p>}
        <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent2 px-6 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {mode === "in" ? "Se connecter" : "S'inscrire"}
        </button>
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm text-accent">
        {mode === "in" ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
      </button>
    </div>
  );
}
