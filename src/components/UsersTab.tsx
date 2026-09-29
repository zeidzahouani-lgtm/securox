import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createAccount } from "@/lib/admin.functions";
import { listAdmins, listClients, listScanners } from "@/lib/gate";

type Role = "admin" | "scanner" | "client";
const LABELS: Record<Role, string> = { admin: "admin", scanner: "scanner", client: "client" };

function AccountPanel({ role }: { role: Role }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createAccount);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const list = useQuery({
    queryKey: [role === "scanner" ? "scanners" : role === "client" ? "clients" : "admins"],
    queryFn: role === "scanner" ? listScanners : role === "client" ? listClients : listAdmins,
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await createFn({
        data: { role, username, password, fullName: fullName || undefined },
      });
      if (r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      setUsername("");
      setPassword("");
      setFullName("");
      list.refetch();
      qc.invalidateQueries({ queryKey: ["scanners"] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="glass-panel rounded-3xl p-6">
      <h2 className="mb-5 font-display text-2xl font-bold">Nouveau {LABELS[role]}</h2>
      <div className="space-y-4">
        <div>
          <label className="field-label">Nom (optionnel)</label>
          <input className="field-input mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Nom d'utilisateur</label>
          <input className="field-input mt-1" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Mot de passe (8 caractères min.)</label>
          <input className="field-input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-rose">{err}</p>}
        <button
          disabled={create.isPending || username.trim().length < 3 || password.length < 8}
          onClick={() => {
            setErr(null);
            create.mutate();
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent2 px-6 py-3 font-display text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          {create.isPending && <Loader2 className="size-4 animate-spin" />}
          Créer le compte
        </button>
      </div>
      <ul className="mt-8 space-y-2 text-sm">
        {list.data?.map((u) => (
          <li key={u.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="font-semibold">{u.full_name || u.username || "—"}</p>
            <p className="text-muted-foreground">{u.username ? `@${u.username}` : u.email}</p>
          </li>
        ))}
        {!list.data?.length && <p className="text-muted-foreground">Aucun compte.</p>}
      </ul>
    </div>
  );
}

export function UsersTab() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <AccountPanel role="admin" />
      <AccountPanel role="scanner" />
      <AccountPanel role="client" />
    </div>
  );
}
