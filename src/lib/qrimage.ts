function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

/** Renders a QR code on a white card with a title and a caption, then saves it as a JPG. */
export async function downloadQrJpg(opts: {
  value: string;
  title: string;
  subtitle?: string;
  fileName: string;
}) {
  const QR = (await import("qrcode")).default;
  const size = 420;
  const url = await QR.toDataURL(opts.value, { margin: 2, width: size, errorCorrectionLevel: "M" });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("QR image impossible"));
    img.src = url;
  });

  const pad = 24;
  const textH = opts.subtitle ? 104 : 72;
  const out = document.createElement("canvas");
  out.width = size + pad * 2;
  out.height = size + pad * 2 + textH;
  const ctx = out.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(img, pad, pad, size, size);

  ctx.textAlign = "center";
  ctx.fillStyle = "#111111";
  ctx.font = "700 26px Arial, sans-serif";
  ctx.fillText(fitText(ctx, opts.title, out.width - pad * 2), out.width / 2, size + pad + 34);
  if (opts.subtitle) {
    ctx.font = "18px Arial, sans-serif";
    ctx.fillStyle = "#555555";
    ctx.fillText(fitText(ctx, opts.subtitle, out.width - pad * 2), out.width / 2, size + pad + 66);
  }

  const name = opts.fileName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-") || "qr";
  const link = document.createElement("a");
  link.download = `${name}.jpg`;
  link.href = out.toDataURL("image/jpeg", 0.95);
  link.click();
}
