import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, UtensilsCrossed } from "lucide-react";
import { Frame } from "@/components/AppShell";
import { guestMenu, menuUrl } from "@/lib/gate";

export const Route = createFileRoute("/m/$code")({
  head: () => ({
    meta: [
      { title: "Menu de l'événement — Securox" },
      { name: "description", content: "Consultez le menu de l'événement depuis votre QR code d'invitation." },
      { property: "og:title", content: "Menu de l'événement — Securox" },
      { property: "og:description", content: "Consultez le menu de l'événement depuis votre QR code d'invitation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: MenuPage,
});

function MenuPage() {
  const { code } = Route.useParams();
  const q = useQuery({
    queryKey: ["guest-menu", code],
    queryFn: async () => {
      const m = await guestMenu(code);
      if (!m) return null;
      return { ...m, url: m.menu_path ? await menuUrl(m.menu_path) : null };
    },
    retry: false,
  });
  if (q.isLoading) return <Frame><Loader2 className="mx-auto size-6 animate-spin text-primary" /></Frame>;
  const m = q.data;
  if (!m) return <Frame><div className="glass-panel rounded-lg p-6 text-sm text-rose">Invitation introuvable ou événement terminé.</div></Frame>;
  const isPdf = m.menu_path?.toLowerCase().endsWith(".pdf");
  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="glass-panel rounded-lg p-6">
          {m.guest_name && <p className="text-sm text-muted-foreground">Bienvenue {m.guest_name}</p>}
          <h1 className="font-display text-2xl font-bold">{m.title}</h1>
          {m.room && <p className="text-sm text-muted-foreground">Salle : {m.room}</p>}
          <p className="mt-2 text-sm text-muted-foreground">Gardez ce QR code : il sera scanné à l'entrée.</p>
        </div>
        <div className="glass-panel rounded-lg p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><UtensilsCrossed className="size-5 text-primary" /> Menu</h2>
          {!m.url ? <p className="text-sm text-muted-foreground">Le menu n'est pas encore disponible.</p>
            : isPdf ? (
              <>
                <iframe src={m.url} title="Menu" className="h-[75vh] w-full rounded-md border border-border" />
                <a href={m.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary underline">Ouvrir le menu (PDF)</a>
              </>
            ) : <img src={m.url} alt={`Menu — ${m.title}`} className="w-full rounded-md" />}
        </div>
      </div>
    </Frame>
  );
}
