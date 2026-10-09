import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/admin-hotel")({
  head: () => ({
    meta: [
      { title: "Administration hôtel — Securox" },
      { name: "description", content: "Gestion des événements, salles, sessions et facturation." },
      { property: "og:title", content: "Administration hôtel — Securox" },
      { property: "og:description", content: "Securox — contrôle d'accès événementiel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell />,
});
