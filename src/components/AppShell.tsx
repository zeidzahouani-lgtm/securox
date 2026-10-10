import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Images, KeyRound, Loader2, LogOut, ScanLine, UtensilsCrossed } from "lucide-react";
import { MediaLibrary } from "./MediaLibrary";
import { OutletsTab } from "./OutletsTab";
import { useAuth, signOut, type Role } from "@/lib/auth";
import { RoleGate } from "./RoleGate";
import { EventsTab } from "./EventsTab";
import { ScannerTab } from "./ScannerTab";
import { UsersTab } from "./UsersTab";
import { ClientTab } from "./ClientTab";
import { ThemeToggle } from "./ThemeToggle";
import logoAsset from "@/assets/securox-logo.jpg.asset.json";
import { Button } from "@/components/ui/button";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", scanner: "Scanner", client: "Client" };

export function Frame({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-body text-foreground">
        <header className="border-b-4 border-primary bg-header text-header-foreground no-print">
          <div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-3 px-4 md:px-8">
          <div className="flex items-center gap-4">
          <img src={logoAsset.url} alt="Securox by dravox" className="h-16 w-auto max-w-24 rounded-md bg-paper object-contain px-1.5 py-0.5" />
          <span className="hidden border-l border-header-muted/30 pl-4 font-display text-sm font-semibold sm:block">SECUROX</span>
          </div>
          <div className="flex items-center gap-3">
            {right}
            <ThemeToggle />
          </div>
          </div>
        </header>
      <main className="relative mx-auto max-w-[1440px] px-4 py-8 md:px-8">
        {children}
      </main>
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
          <Button variant="ghost" size="icon" title="Quitter"
            onClick={async () => { await qc.cancelQueries(); qc.clear(); await signOut(); }}
            className="border border-header-muted/30 text-header-foreground hover:bg-primary"
            aria-label="Quitter"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      }
    >
      {children ? children(role) : <RoleHome role={role} />}
    </Frame>
  );
}

type AdminTab = "events" | "library" | "outlets" | "scanner" | "users";
function RoleHome({ role }: { role: Role }) {
  const [tab, setTab] = useState<AdminTab>("events");
  if (role === "client") return <ClientTab />;
  if (role === "scanner") return <ScannerTab />;
  const groups = [
    ["Gestion", [["events", "Événements", CalendarDays], ["scanner", "Scanner live", ScanLine]]],
    ["Contenu", [["library", "Médiathèque", Images], ["outlets", "Menus & QR", UtensilsCrossed]]],
    ["Réglages", [["users", "Codes PIN", KeyRound]]],
  ] as const;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="glass-panel h-fit rounded-lg p-3 no-print lg:sticky lg:top-4">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-4">
          {groups.map(([g, items]) => (
            <div key={g} className="flex gap-1 lg:flex-col">
              <p className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">{g}</p>
              {items.map(([k, label, Icon]) => (
                <Button key={k} variant={tab === k ? "default" : "ghost"} onClick={() => setTab(k)}
                  className="h-10 justify-start whitespace-nowrap px-3 font-semibold" aria-pressed={tab === k}>
                  <Icon className="size-4" /> {label}
                </Button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <section className="min-w-0">
        {tab === "events" ? <EventsTab /> : tab === "users" ? <UsersTab /> : tab === "library" ? <MediaLibrary />
          : tab === "outlets" ? <OutletsTab /> : <ScannerTab />}
      </section>
    </div>
  );
}
