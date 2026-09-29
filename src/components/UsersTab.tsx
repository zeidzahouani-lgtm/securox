import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClientAccount, createScannerAccount } from "@/lib/admin.functions";
import { listClients, listScanners } from "@/lib/gate";

export function UsersTab() {
  const qc = useQueryClient();
  const createScannerFn = useServerFn(createScannerAccount);
  const createClientFn = useServerFn(createClientAccount);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientUsername, setClientUsername] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [clientErr, setClientErr] = useState<string | null>(null);

  const scanners = useQuery({ queryKey: ["scanners"], queryFn: listScanners });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const createScanner = useMutation({
    mutationFn: async () => {
      const r = await createScannerFn({ data: { email, password, fullName } });
      if (r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      setEmail("");
      setPassword("");
      setFullName("");
      qc.invalidateQueries({ queryKey: ["scanners"] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const createClient = useMutation({
    mutationFn: async () => {
      const r = await createClientFn({
        data: { username: clientUsername, password: clientPassword, fullName: clientName || undefined },
      });
      if (r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      setClientUsername("");
      setClientPassword("");
      setClientName("");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => setClientErr(e.message),
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="glass-panel rounded-3xl p-6">
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
            disabled={createScanner.isPending || !email || password.length < 8}
            onClick={() => {
              setErr(null);
              createScanner.mutate();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent2 px-6 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40"
          >
            {createScanner.isPending && <Loader2 className="size-4 animate-spin" />}
            Créer le compte scanner
          </button>
        </div>
        <h3 className="mb-4 mt-8 font-display text-lg font-semibold">Scanners</h3>
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

      <div className="glass-panel rounded-3xl p-6">
        <h2 className="mb-1 font-display text-2xl font-bold">Nouveau client</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Le client se connecte avec son nom d'utilisateur et son mot de passe, sans email.
        </p>
        <div className="space-y-4">
          <div>
            <label className="field-label">Nom (optionnel)</label>
            <input className="field-input mt-1" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Nom d'utilisateur</label>
            <input
              className="field-input mt-1"
              value={clientUsername}
              onChange={(e) => setClientUsername(e.target.value)}
              placeholder="ex. restaurant-palmier"
            />
          </div>
          <div>
            <label className="field-label">Mot de passe (8 caractères min.)</label>
            <input className="field-input mt-1" value={clientPassword} onChange={(e) => setClientPassword(e.target.value)} />
          </div>
          {clientErr && <p className="text-sm text-rose">{clientErr}</p>}
          <button
            disabled={createClient.isPending || clientUsername.trim().length < 3 || clientPassword.length < 8}
            onClick={() => {
              setClientErr(null);
              createClient.mutate();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent2 px-6 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40"
          >
            {createClient.isPending && <Loader2 className="size-4 animate-spin" />}
            Créer le compte client
          </button>
        </div>
        <h3 className="mb-4 mt-8 font-display text-lg font-semibold">Clients</h3>
        <ul className="space-y-2 text-sm">
          {clients.data?.map((c) => (
            <li key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-semibold">{c.full_name || c.username || "—"}</p>
              <p className="text-muted-foreground">
                {c.username ? `@${c.username}` : c.email}
              </p>
            </li>
          ))}
          {!clients.data?.length && <p className="text-muted-foreground">Aucun client.</p>}
        </ul>
      </div>
    </div>
  );
}
