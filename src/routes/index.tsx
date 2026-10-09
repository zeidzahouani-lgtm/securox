import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Securox — Contrôle d'accès événementiel" },
      { name: "description", content: "Admin, clients et scanners : créez vos événements, générez les QR codes nominatifs et contrôlez l'entrée en direct." },
      { property: "og:title", content: "Securox — Contrôle d'accès événementiel" },
      { property: "og:description", content: "Créez vos événements, générez les QR codes nominatifs et contrôlez l'entrée en direct." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell />,
});
