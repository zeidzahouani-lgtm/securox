import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EventsTab } from "@/components/EventsTab";
import { ScannerTab } from "@/components/ScannerTab";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PulseGate — Event Access Control" },
      {
        name: "description",
        content:
          "Create events, mint QR tickets and run the door with live capacity counters and over-limit decisions.",
      },
      { property: "og:title", content: "PulseGate — Event Access Control" },
      {
        property: "og:description",
        content:
          "Create events, mint QR tickets and run the door with live capacity counters and over-limit decisions.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [tab, setTab] = useState<"events" | "scanner">("events");

  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-body text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 size-[520px] rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 size-[560px] rounded-full bg-accent2/20 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 size-[420px] rounded-full bg-mint/10 blur-[120px]" />
      </div>
      <div className="pointer-events-none absolute inset-0">
        <div className="glass-panel absolute -top-24 right-10 h-[520px] w-[420px] animate-drift rounded-3xl" />
        <div className="glass-panel absolute -left-20 bottom-10 h-[460px] w-[380px] animate-drift2 rounded-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1440px] px-6 py-6">
        <header className="mb-8 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent2 font-display text-lg font-bold text-accent-foreground">
              P
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-none tracking-tight">PulseGate</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Access Control</p>
            </div>
          </div>
          <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-accent2 to-accent font-display text-sm font-bold text-accent-foreground">
            DM
          </div>
        </header>

        <div className="mb-8 flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 no-print">
          <button
            onClick={() => setTab("events")}
            className={`rounded-full px-5 py-2 text-sm ${
              tab === "events"
                ? "bg-gradient-to-r from-accent to-accent2 font-display font-semibold text-accent-foreground"
                : "text-white/60"
            }`}
          >
            Events &amp; QR Generator
          </button>
          <button
            onClick={() => setTab("scanner")}
            className={`rounded-full px-5 py-2 text-sm ${
              tab === "scanner"
                ? "bg-gradient-to-r from-accent to-accent2 font-display font-semibold text-accent-foreground"
                : "text-white/60"
            }`}
          >
            Live Scanner &amp; Gate
          </button>
        </div>

        {tab === "events" ? <EventsTab /> : <ScannerTab />}
      </div>
    </div>
  );
}
