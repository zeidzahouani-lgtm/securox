import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { useAuth, signOut, type Role } from "@/lib/auth";
import { AuthForm } from "./AuthForm";
import { EventsTab } from "./EventsTab";
import { ScannerTab } from "./ScannerTab";
import { UsersTab } from "./UsersTab";
import { ClientTab } from "./ClientTab";
import logoAsset from "@/assets/dravox-access-logo.png.asset.json";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", scanner: "Scanner", client: "Client" };

export function Frame({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-body text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 size-[520px] rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 size-[560px] rounded-full bg-accent2/20 blur-[130px]" />
      </div>
      <div className="relative z-10 mx-auto max-w-[1440px] px-6 py-6">
        <header className="mb-8 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Dravox Access" className="h-10 w-auto rounded-lg bg-white object-contain px-1.5 py-0.5" />
          </div>
          {right}
        </header>
        {children}
      </div>
    </div>
  );
}

export function AppShell({ authSubtitle, children }: { authSubtitle?: string; children?: (role: Role) => ReactNode }) {
  const { session, ready, role } = useAuth();
  const qc = useQueryClient();

  if (!ready || (session && !role)) {
    return <Frame><div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-accent" /></div></Frame>;
  }
  if (!session || !role) return <Frame><AuthForm subtitle={authSubtitle} /></Frame>;

  return (
    <Frame
      right={
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{session.user.email}</span>
          <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">{ROLE_LABEL[role]}</span>
          <button
            onClick={async () => {
              await qc.cancelQueries();
              qc.clear();
              await signOut();
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Se déconnecter"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      }
    >
      {children ? children(role) : <RoleHome role={role} />}
    </Frame>
  );
}

function RoleHome({ role }: { role: Role }) {
  const [tab, setTab] = useState<"events" | "users" | "scanner">("events");
  if (role === "client") return <ClientTab />;
  if (role === "scanner") return <ScannerTab />;
  const tabs = [
    ["events", "Événements"],
    ["users", "Utilisateurs"],
    ["scanner", "Scanner"],
  ] as const;
  return (
    <>
      <div className="mb-8 flex w-fit items-center gap-1 rounded-full border border-border bg-muted/50 p-1 no-print">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-5 py-2 text-sm ${tab === k ? "bg-gradient-to-r from-accent to-accent2 font-display font-semibold text-accent-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "events" ? <EventsTab /> : tab === "users" ? <UsersTab /> : <ScannerTab />}
    </>
  );
}
