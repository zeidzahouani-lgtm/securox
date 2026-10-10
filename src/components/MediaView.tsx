import { FileText } from "lucide-react";
import { kind } from "@/lib/media";

export function MediaView({ url, mime, name, compact }: { url: string; mime: string; name: string; compact?: boolean }) {
  const k = kind(mime, name.toLowerCase());
  if (k === "image") return <img src={url} alt={name} className={compact ? "h-32 w-full rounded-md object-cover" : "w-full rounded-md"} />;
  if (k === "video") return <video src={url} controls playsInline className={compact ? "h-32 w-full rounded-md bg-muted object-cover" : "w-full rounded-md"} />;
  if (k === "pdf" && !compact)
    return (
      <div>
        <iframe src={url} title={name} className="h-[75vh] w-full rounded-md border border-border" />
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary underline">Ouvrir le PDF</a>
      </div>
    );
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex h-32 flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground">
      <FileText className="size-8 text-primary" /> PDF
    </a>
  );
}
