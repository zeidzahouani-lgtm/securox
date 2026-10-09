export type BadgeItem = { code: string; name: string };

/** One PDF with every QR code as cut-ready badges (3 x 4 per A4 page). */
export async function downloadQrPdf(title: string, room: string | null | undefined, items: BadgeItem[]) {
  const { jsPDF } = await import("jspdf");
  const QR = (await import("qrcode")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cols = 3, rows = 4, mx = 10, my = 12;
  const w = (210 - mx * 2) / cols, h = (297 - my * 2) / rows;
  for (let i = 0; i < items.length; i++) {
    const slot = i % (cols * rows);
    if (i > 0 && slot === 0) doc.addPage();
    const x = mx + (slot % cols) * w, y = my + Math.floor(slot / cols) * h;
    doc.setDrawColor(180); doc.setLineDashPattern([1.5, 1.5], 0); doc.rect(x, y, w, h);
    doc.setLineDashPattern([], 0);
    doc.setFillColor(200, 30, 30); doc.rect(x, y, w, 7, "F");
    doc.setTextColor(255); doc.setFontSize(8);
    doc.text(title.slice(0, 40), x + w / 2, y + 4.8, { align: "center" });
    const url = await QR.toDataURL(items[i]!.code, { margin: 1, width: 400 });
    const q = Math.min(w - 16, h - 30);
    doc.addImage(url, "PNG", x + (w - q) / 2, y + 10, q, q);
    doc.setTextColor(20); doc.setFontSize(11);
    doc.text(items[i]!.name.slice(0, 32), x + w / 2, y + 14 + q, { align: "center" });
    doc.setFontSize(9); doc.setTextColor(90);
    doc.text(items[i]!.code + (room ? ` · ${room}` : ""), x + w / 2, y + 19 + q, { align: "center" });
  }
  doc.save(`qr-codes-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
