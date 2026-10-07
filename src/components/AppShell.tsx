import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, KeyRound, Loader2, LogOut, ScanLine } from "lucide-react";
import { useAuth, signOut, type Role } from "@/lib/auth";
import { RoleGate } from "./RoleGate";
import { EventsTab } from "./EventsTab";
import { ScannerTab } from "./ScannerTab";
import { UsersTab } from "./UsersTab";
import { ClientTab } from "./ClientTab";
import { ThemeToggle } from "./ThemeToggle";
import logoAsset from "@/assets/dravox-access-logo.png.asset.json";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", scanner: "Scanner", client: "Client" };

export function Frame({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-body text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 size-[560px] rounded-full bg-glow blur-[120px]" />
        <div className="absolute -right-40 top-1/3 size-[560px] rounded-full bg-glow2 blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(var(--line)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
      </div>
      <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-5 md:px-6">
        <header className="mb-8 flex items-center justify-between gap-3 no-print">
          <img src={logoAsset.url} alt="Dravox Access" className="h-10 w-auto rounded-lg bg-white object-contain px-1.5 py-0.5 shadow-sm" />
          <div className="flex items-center gap-3">
            {right}
            <ThemeToggle />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function AppShell({ children }: { authSubtitle?: string; children?: (role: Role) => ReactNode }) {
  const { session, ready, role } = useAuth();
  const qc = useQueryClient();

  if (!ready || (session && !role)) {
    return <Frame><div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-accent" /></div></Frame>;
  }
  if (!session || !role) return <Frame><RoleGate /></Frame>;

  return (
    <Frame
      right={
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
            <span className="size-1.5 animate-softpulse rounded-full bg-mint" />
            {ROLE_LABEL[role]}
          </span>
          <button
            onClick={async () => { await qc.cancelQueries(); qc.clear(); await signOut(); }}
            className="grid size-9 place-items-center rounded-full border border-border bg-muted/50 text-muted-foreground hover:text-foreground"
            aria-label="Quitter"
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
    ["events", "Événements", CalendarDays],
    ["scanner", "Scanner live", ScanLine],
    ["users", "Codes PIN", KeyRound],
  ] as const;
  return (
    <>
      <div className="mb-8 flex w-fit items-center gap-1 rounded-full border border-border bg-muted/50 p-1 no-print">
        {tabs.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${tab === k ? "bg-gradient-to-r from-accent to-accent2 font-display font-semibold text-accent-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {tab === "events" ? <EventsTab /> : tab === "users" ? <UsersTab /> : <ScannerTab />}
    </>
  );
}
