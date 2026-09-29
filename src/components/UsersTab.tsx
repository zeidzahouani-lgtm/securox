import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createScannerAccount } from "@/lib/admin.functions";
import { listScanners } from "@/lib/gate";

export function UsersTab() {
  const qc = useQueryClient();
  const createFn = useServerFn(createScannerAccount);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const scanners = useQuery({ queryKey: ["scanners"], queryFn: listScanners });

  const create = useMutation({
    mutationFn: () => createFn({ data: { email, password, fullName } }),
    onSuccess: () => {
      setEmail("");
      setPassword("");
      setFullName("");
      qc.invalidateQueries({ queryKey: ["scanners"] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="glass-panel rounded-3xl p-6 lg:col-span-7">
        <h2 className="mb-5 font-display text-2xl font-bold">Nouveau scanner</h2>
        <div className="space-y-4">
          <div>
            <label className="field-label">Nom</label>
            <input className="field-input mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input type="email" className="field-input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Mot de passe (8 caractères min.)</label>
            <input className="field-input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <p className="text-sm text-rose">{err}</p>}
          <button
            disabled={create.isPending || !email || password.length < 8}
            onClick={() => {
              setErr(null);
              create.mutate();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent2 px-6 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40"
          >
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Créer le compte scanner
          </button>
        </div>
      </div>
      <div className="glass-panel rounded-3xl p-6 lg:col-span-5">
        <h3 className="mb-4 font-display text-lg font-semibold">Scanners</h3>
        <ul className="space-y-2 text-sm">
          {scanners.data?.map((s) => (
            <li key={s.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-semibold">{s.full_name || "—"}</p>
              <p className="text-muted-foreground">{s.email}</p>
            </li>
          ))}
          {!scanners.data?.length && <p className="text-muted-foreground">Aucun scanner.</p>}
        </ul>
      </div>
    </div>
  );
}
