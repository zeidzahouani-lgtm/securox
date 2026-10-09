import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Agent scanner — Securox" },
      { name: "description", content: "Contrôle d'accès rapide pour les agents à l'entrée." },
      { property: "og:title", content: "Agent scanner — Securox" },
      { property: "og:description", content: "Securox — contrôle d'accès événementiel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell />,
});
