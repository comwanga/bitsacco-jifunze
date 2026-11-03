// Generates the web-app icons (a baobab at sunrise) as PNGs with no image dependencies.
// Run once after changing the design: node scripts/make-icons.mjs
import fs from "node:fs";
import zlib from "node:zlib";

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const NIGHT = hex("#1b2550");
const DUSK = hex("#5a3767");
const EMBER = hex("#c8603f");
const DAWN = hex("#f3b866");
const SUN = hex("#fff1c4");
const GROUND = hex("#2a140e");
const BARK = hex("#3b1e14");
const LEAF = hex("#3d4a26");

// Shapes in a 0..1 unit square.
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function nearSegment(x, y, [ax, ay], [bx, by], w) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= w / 2;
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function sky(y) {
  const stops = [
    [0, NIGHT],
    [0.3, DUSK],
    [0.52, EMBER],
    [0.64, DAWN],
  ];
  if (y <= 0) return NIGHT;
  for (let i = 1; i < stops.length; i++) {
    if (y <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (y - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return DAWN;
}

// Design scaled into the centre ~76% so it also works as a maskable icon.
function colorAt(u, v) {
  const s = 0.76;
  const x = (u - 0.5) / s + 0.5;
  const y = (v - 0.5) / s + 0.5;
  const horizon = 0.715;
  let c = y < horizon ? sky((v / ((horizon - 0.5) * s + 0.5)) * 0.64) : GROUND;
  if (inEllipse(x, y, 0.36, horizon, 0.1, 0.1) && y < horizon) c = SUN;
  const trunk = [
    [0.44, 0.72],
    [0.43, 0.58],
    [0.46, 0.45],
    [0.54, 0.45],
    [0.57, 0.58],
    [0.56, 0.72],
  ];
  if (inPoly(x, y, trunk)) c = BARK;
  if (nearSegment(x, y, [0.47, 0.47], [0.3, 0.3], 0.045)) c = BARK;
  if (nearSegment(x, y, [0.53, 0.47], [0.7, 0.3], 0.045)) c = BARK;
  if (nearSegment(x, y, [0.5, 0.46], [0.5, 0.29], 0.035)) c = BARK;
  for (const [cx, cy, rx, ry] of [
    [0.29, 0.27, 0.09, 0.045],
    [0.71, 0.27, 0.09, 0.045],
    [0.5, 0.26, 0.08, 0.04],
  ]) {
    if (inEllipse(x, y, cx, cy, rx, ry)) c = LEAF;
  }
  return c;
}

function png(size) {
  const SS = 4;
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
        }
      }
      for (let k = 0; k < 3; k++) row[1 + px * 3 + k] = Math.round(acc[k] / (SS * SS));
    }
    rows.push(row);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) fs.writeFileSync(`public/icons/icon-${size}.png`, png(size));
fs.writeFileSync("public/icons/apple-touch-icon.png", png(180));
console.log("icons written to public/icons/");
