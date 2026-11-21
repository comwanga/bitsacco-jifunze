// Generates the web-app icons from the Bitsacco mark in public/logo.svg, exactly as the site header shows it
// (components/layout/BitsaccoLogo.tsx with `mark`: viewBox 21 12 104 104, teal-200 on the night header).
// No image dependencies. Run after changing the logo: node scripts/make-icons.ts
// The file names are part of cache busting: change them when the artwork changes, so browsers, the service worker
// and installed apps fetch new URLs instead of a cached image.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";

export const MARK_VIEWBOX = [21, 12, 104, 104] as const; // the header's crop of public/logo.svg
export const BACKGROUND = "#1b2550"; // --color-night, the header background
export const FOREGROUND = "#99f6e4"; // --color-teal-200, the header mark

/** `scale` is the share of the icon's width given to the 104-unit mark crop; the rest is even padding. */
export const ICONS = [
  { file: "jifunze-192.png", size: 192, scale: 0.8 },
  { file: "jifunze-512.png", size: 512, scale: 0.8 },
  // Maskable: the mark's outer ring stays well inside the 40%-radius safe zone, so no mask shape crops it.
  { file: "jifunze-maskable-512.png", size: 512, scale: 0.64 },
  { file: "jifunze-apple-touch-180.png", size: 180, scale: 0.8 },
] as const;

const SS = 4; // supersampling per axis
const CURVE_STEPS = 16;

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** The single even-odd path of logo.svg. Fails closed on anything this renderer does not implement. */
export function logoPath(svg: string): string {
  const paths = [...svg.matchAll(/<path\b[^>]*>/g)].map((m) => m[0]);
  if (paths.length !== 1) throw Error(`expected one <path> in logo.svg, found ${paths.length}`);
  if (!/\sfill-rule="evenodd"/.test(paths[0])) throw Error("logo.svg path must use fill-rule=evenodd");
  const d = /\sd="([^"]+)"/.exec(paths[0]);
  if (!d) throw Error("logo.svg path has no d attribute");
  return d[1];
}

/** Absolute M/L/H/V/C/Z only (all logo.svg uses), flattened to closed polygons. */
function polygons(d: string): number[][][] {
  const tokens: string[] = [];
  const re = /([MLHVCZ])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)|[\s,]+/gy;
  for (let m; re.lastIndex < d.length; ) {
    const at = re.lastIndex;
    if (!(m = re.exec(d))) throw Error(`unsupported path data at ${at}: ${d.slice(at, at + 12)}`);
    if (m[1] || m[2]) tokens.push(m[1] ?? m[2]);
  }
  const out: number[][][] = [];
  let poly: number[][] = [];
  let x = 0;
  let y = 0;
  let i = 0;
  let cmd = "";
  const num = () => {
    const n = Number(tokens[i++]);
    if (!Number.isFinite(n)) throw Error("malformed path data");
    return n;
  };
  const close = () => {
    if (poly.length > 2) out.push(poly);
    poly = [];
  };
  while (i < tokens.length) {
    if (/[A-Z]/.test(tokens[i])) cmd = tokens[i++];
    else if (cmd === "M") cmd = "L"; // implicit lineto after a moveto
    else if (!cmd || cmd === "Z") throw Error("path data without a command");
    if (cmd === "M") {
      close();
      x = num();
      y = num();
      poly.push([x, y]);
    } else if (cmd === "L") {
      x = num();
      y = num();
      poly.push([x, y]);
    } else if (cmd === "H") {
      x = num();
      poly.push([x, y]);
    } else if (cmd === "V") {
      y = num();
      poly.push([x, y]);
    } else if (cmd === "C") {
      const [x1, y1, x2, y2, x3, y3] = [num(), num(), num(), num(), num(), num()];
      for (let s = 1; s <= CURVE_STEPS; s++) {
        const t = s / CURVE_STEPS;
        const u = 1 - t;
        poly.push([
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
      x = x3;
      y = y3;
    } else if (cmd === "Z") {
      const start = poly[0];
      close();
      if (start) [x, y] = start;
    }
  }
  close();
  return out;
}

/** PNG scanlines (filter byte 0, then RGB) of the mark centred on the header background. */
export function renderRows(d: string, size: number, scale: number): Buffer {
  const [vx, vy, vw] = MARK_VIEWBOX;
  const k = (size * scale) / vw;
  const pad = (size * (1 - scale)) / 2;
  const edges: number[][] = [];
  for (const poly of polygons(d)) {
    for (let a = 0; a < poly.length; a++) {
      const p = poly[a];
      const q = poly[(a + 1) % poly.length];
      edges.push([(p[0] - vx) * k + pad, (p[1] - vy) * k + pad, (q[0] - vx) * k + pad, (q[1] - vy) * k + pad]);
    }
  }
  // Like the header's viewBox, the crop clips: the BITSACCO wordmark below the mark is never drawn.
  const clipFrom = pad;
  const clipTo = pad + size * scale;
  const bg = rgb(BACKGROUND);
  const fg = rgb(FOREGROUND);
  const rows = Buffer.alloc(size * (1 + size * 3));
  const cover = new Uint8Array(size);
  for (let py = 0; py < size; py++) {
    cover.fill(0);
    for (let sy = 0; sy < SS; sy++) {
      const yy = py + (sy + 0.5) / SS;
      if (yy < clipFrom || yy >= clipTo) continue;
      const xs: number[] = [];
      for (const [x0, y0, x1, y1] of edges) {
        if (y0 > yy !== y1 > yy) xs.push(x0 + ((yy - y0) * (x1 - x0)) / (y1 - y0));
      }
      xs.sort((a, b) => a - b);
      // Even-odd: every other crossing opens a filled span; count the subsamples whose centre it contains.
      for (let s = 0; s + 1 < xs.length; s += 2) {
        const from = Math.ceil(Math.max(xs[s], clipFrom) * SS - 0.5);
        const to = Math.ceil(Math.min(xs[s + 1], clipTo) * SS - 0.5);
        for (let sx = from; sx < to; sx++) cover[Math.floor(sx / SS)]++;
      }
    }
    const row = py * (1 + size * 3);
    for (let px = 0; px < size; px++) {
      const t = cover[px] / (SS * SS);
      for (let c = 0; c < 3; c++) rows[row + 1 + px * 3 + c] = Math.round(bg[c] + (fg[c] - bg[c]) * t);
    }
  }
  return rows;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let b = 0; b < 8; b++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
}

/** An opaque 8-bit RGB PNG. */
export function encodePng(size: number, rows: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const d = logoPath(fs.readFileSync("public/logo.svg", "utf8"));
  for (const { file, size, scale } of ICONS) fs.writeFileSync(`public/icons/${file}`, encodePng(size, renderRows(d, size, scale)));
  console.log(`icons written to public/icons/: ${ICONS.map((i) => i.file).join(", ")}`);
}
