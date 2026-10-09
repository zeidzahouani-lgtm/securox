import type { ImportRow } from "@/lib/gate";

export type ParsedImport = { rows: ImportRow[]; missing: number[]; duplicates: number[]; total: number };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const FIRST = ["prenom", "first name", "firstname", "first"];
const LAST = ["nom", "nom de famille", "last name", "lastname", "last", "surname"];
const EMAIL = ["email", "e-mail", "mail", "courriel"];
const PHONE = ["telephone", "tel", "phone", "mobile", "portable"];

export async function parseParticipants(file: File): Promise<ParsedImport> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headers = Object.keys(raw[0] ?? {});
  const find = (keys: string[]) => headers.find((h) => keys.includes(norm(h)));
  const hf = find(FIRST), hl = find(LAST), he = find(EMAIL), hp = find(PHONE);
  if (!hf && !hl) throw new Error("Colonnes « Nom » et « Prénom » introuvables");
  const rows: ImportRow[] = []; const missing: number[] = []; const duplicates: number[] = [];
  const seen = new Set<string>();
  raw.forEach((r, i) => {
    const line = i + 2;
    const first = String(hf ? r[hf] : "").trim(), last = String(hl ? r[hl] : "").trim();
    if (!first && !last) return;
    if (!first || !last) { missing.push(line); return; }
    const k = norm(first + " " + last);
    if (seen.has(k)) { duplicates.push(line); return; }
    seen.add(k);
    rows.push({ first, last, email: he ? String(r[he]).trim() : undefined, phone: hp ? String(r[hp]).trim() : undefined });
  });
  return { rows, missing, duplicates, total: raw.length };
}
