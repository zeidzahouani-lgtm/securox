import { Button } from "@/components/ui/button";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function PinPanel({ role, label }: { role: "admin" | "scanner"; label: string }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <div className="glass-panel rounded-lg p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-accent/15 text-accent"><KeyRound className="size-5" /></span>
        <h2 className="font-display text-xl font-bold">PIN {label}</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Code demandé pour entrer dans l'espace {label}. 4 à 8 chiffres.</p>
      <form className="flex gap-2" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setMsg(null);
        const { error } = await (supabase.rpc as any)("set_pin", { _role: role, _pin: pin });
        setBusy(false);
        setMsg(error ? { ok: false, t: error.message } : { ok: true, t: "Code mis à jour" });
        if (!error) setPin("");
      }}>
        <input inputMode="numeric" maxLength={8} className="field-input font-mono tracking-[0.3em]" placeholder="Nouveau PIN"
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        <Button variant="ghost" disabled={busy || pin.length < 4}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40">
          {busy && <Loader2 className="size-4 animate-spin" />} Changer
        </Button>
      </form>
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-mint" : "text-rose"}`}>{msg.t}</p>}
    </div>
  );
}

export function UsersTab() {
  return (
    <div className="grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
      <PinPanel role="admin" label="Admin" />
      <PinPanel role="scanner" label="Scanner" />
    </div>
  );
}
