import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Frame } from "@/components/AppShell";
import { MediaView } from "@/components/MediaView";
import { outletPublic, signedUrls } from "@/lib/media";

export const Route = createFileRoute("/p/$token")({
  head: () => ({
    meta: [
      { title: "Menu — Securox" },
      { name: "description", content: "Menu et carte du restaurant ou du point de vente." },
      { property: "og:title", content: "Menu — Securox" },
      { property: "og:description", content: "Menu et carte du restaurant ou du point de vente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: OutletPage,
});

function OutletPage() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["outlet", token],
    queryFn: async () => {
      const o = await outletPublic(token);
      if (!o) return null;
      return { ...o, urls: await signedUrls(o.media.map((m) => m.path)) };
    },
    retry: false,
  });
  if (q.isLoading) return <Frame><Loader2 className="mx-auto size-6 animate-spin text-primary" /></Frame>;
  const o = q.data;
  if (!o) return <Frame><div className="glass-panel rounded-lg p-6 text-sm text-rose">Page introuvable.</div></Frame>;
  return (
    <Frame>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="glass-panel rounded-lg p-6">
          <h1 className="font-display text-2xl font-bold break-words">{o.name}</h1>
          {o.description && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{o.description}</p>}
        </div>
        {!o.media.length && <p className="text-sm text-muted-foreground">Le menu n'est pas encore disponible.</p>}
        {o.media.map((m, i) => o.urls[m.path] && (
          <div key={i} className="glass-panel rounded-lg p-3"><MediaView url={o.urls[m.path]!} mime={m.mime} name={m.name} /></div>
        ))}
      </div>
    </Frame>
  );
}
