import QRCode from "qrcode";

const LOGO_MARK = `<rect x="162" y="162" width="76" height="76" rx="12" fill="#ffffff" stroke="#000" stroke-width="2"/>
<text x="200" y="212" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="36" font-weight="700" fill="#000">W</text>`;

function stripSvgWrapper(svg: string): string {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/i, "");
}

function wrapSvg(innerSvgFull: string, size: number, label: string): string {
  const body = stripSvgWrapper(innerSvgFull);
  const h = size + 36;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g transform="translate(0,0)">${body}</g>
  <text x="${size / 2}" y="${size + 22}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#0f172a">${label}</text>
</svg>`;
}

/** Inserta logo centrado en el QR (SVG de qrcode). */
function embedLogoInQrSvg(svg: string, viewSize: number): string {
  const close = svg.lastIndexOf("</svg>");
  if (close === -1) return svg;
  const scale = Math.max(0.35, viewSize / 400);
  const box = 76 * scale;
  const margin = (viewSize - box) / 2;
  const logo = `<g transform="translate(${margin},${margin}) scale(${scale})">${LOGO_MARK}</g>`;
  return `${svg.slice(0, close)}${logo}${svg.slice(close)}`;
}

export async function buildQrAssets(params: {
  fullUrl: string;
  labelHostPath: string;
}): Promise<{
  qr_svg_large: string;
  qr_svg_small: string;
  qr_png_large_base64: string;
  qr_png_small_base64: string;
}> {
  const largeSize = 400;
  const smallSize = 200;

  const innerLarge = await QRCode.toString(params.fullUrl, {
    type: "svg",
    width: largeSize,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const innerSmall = await QRCode.toString(params.fullUrl, {
    type: "svg",
    width: smallSize,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const qr_svg_large = wrapSvg(embedLogoInQrSvg(innerLarge, largeSize), largeSize, params.labelHostPath);
  const qr_svg_small = wrapSvg(embedLogoInQrSvg(innerSmall, smallSize), smallSize, params.labelHostPath);

  const bufL = await QRCode.toBuffer(params.fullUrl, {
    type: "png",
    width: largeSize,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const bufS = await QRCode.toBuffer(params.fullUrl, {
    type: "png",
    width: smallSize,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  return {
    qr_svg_large,
    qr_svg_small,
    qr_png_large_base64: bufL.toString("base64"),
    qr_png_small_base64: bufS.toString("base64"),
  };
}
