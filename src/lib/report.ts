import type { AttendeeRow, EventRow, EventReport } from "@/lib/gate";

function statusFr(s: string) {
  if (s === "Checked-in") return "Entré";
  if (s === "Over-limit") return "Entré (facturé)";
  return "Non venu";
}

export async function downloadEventReport(event: EventRow, live: AttendeeRow[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const report: EventReport = event.report ?? {
    generated: live.length,
    checked_in: live.filter((a) => a.status === "Checked-in").length,
    over_limit: live.filter((a) => a.status === "Over-limit").length,
    attendees: live.map((a) => ({
      name: a.guest_name,
      code: a.ticket_code,
      status: a.status,
      checked_in_at: a.checked_in_at,
    })),
  };

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Securox — Rapport de présence", 14, 18);
  doc.setFontSize(11);
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("fr-FR") : "—");
  const lines = [
    `Événement : ${event.title}${event.room ? ` — Salle : ${event.room}` : ""}`,
    `Début : ${fmt(event.date)}   Fin : ${fmt(event.end_date)}`,
    `Capacité initiale : ${event.max_capacity - (event.extra_capacity ?? 0)}`,
    `Places supplémentaires demandées par le client (à facturer) : ${event.extra_capacity ?? 0}`,
    `QR codes générés : ${report.generated}`,
    `Entrées totales : ${report.checked_in + report.over_limit}`,
    `Entrées hors quota (à facturer) : ${report.over_limit}`,
    event.closed_at ? `Clôturé le : ${fmt(event.closed_at)}` : "Statut : en cours",
  ];
  lines.forEach((l, i) => doc.text(l, 14, 30 + i * 7));

  autoTable(doc, {
    startY: 30 + lines.length * 7 + 4,
    head: [["Nom", "Code", "Statut", "Heure d'entrée"]],
    body: report.attendees.map((a) => [a.name ?? "—", a.code, statusFr(a.status), fmt(a.checked_in_at)]),
    headStyles: { fillColor: [30, 64, 175] },
    styles: { fontSize: 9 },
  });

  doc.save(`rapport-${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
