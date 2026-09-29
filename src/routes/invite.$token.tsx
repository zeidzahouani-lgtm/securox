import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ClientTab } from "@/components/ClientTab";
import { claimEvent } from "@/lib/gate";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Invitation — Dravox Access" },
      { name: "description", content: "Créez les QR codes de vos invités pour votre événement." },
      { property: "og:title", content: "Invitation — PulseGate" },
      { property: "og:description", content: "Créez les QR codes de vos invités pour votre événement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  return (
    <AppShell authSubtitle="Connectez-vous ou créez un compte pour générer les QR codes de vos invités.">
      {(role) => (role === "client" ? <Claim token={token} /> : (
        <div className="glass-panel rounded-3xl p-6 text-sm">
          Ce lien est destiné au client. <Link to="/" className="text-accent">Retour à l'accueil</Link>
        </div>
      ))}
    </AppShell>
  );
}

function Claim({ token }: { token: string }) {
  const q = useQuery({ queryKey: ["claim", token], queryFn: () => claimEvent(token), retry: false });
  if (q.isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-accent" />;
  if (q.error) return <div className="glass-panel rounded-3xl p-6 text-sm text-rose">{(q.error as Error).message}</div>;
  return <ClientTab initialEventId={q.data} />;
}
