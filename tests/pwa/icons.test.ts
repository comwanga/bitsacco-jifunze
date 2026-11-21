import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { expect, test } from "vitest";
import { generateMetadata } from "../../app/[lang]/layout";
import { BACKGROUND, FOREGROUND, ICONS, MARK_VIEWBOX, logoPath, renderRows } from "../../scripts/make-icons.ts";

const root = path.join(import.meta.dirname, "../..");
const text = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const manifest = JSON.parse(text("public/manifest.webmanifest")) as {
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
};
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Minimal PNG reader for the icons this repo generates: 8-bit RGB, filter 0 on every row. */
function readPng(url: string) {
  const file = path.join(root, "public", url);
  expect(fs.existsSync(file), url).toBe(true);
  const buf = fs.readFileSync(file);
  expect(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${url} is a PNG`).toBe(true);
  let width = 0, height = 0, bitDepth = 0, colorType = -1;
  const idat: Buffer[] = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString("latin1", at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") [width, height, bitDepth, colorType] = [data.readUInt32BE(0), data.readUInt32BE(4), data[8], data[9]];
    if (type === "IDAT") idat.push(data);
    at += 12 + len;
  }
  const rows = zlib.inflateSync(Buffer.concat(idat));
  const stride = 1 + width * 3;
  expect(rows.length, `${url} pixel data`).toBe(stride * height);
  for (let y = 0; y < height; y++) expect(rows[y * stride], `${url} row ${y} filter`).toBe(0);
  const pixel = (x: number, y: number) => [...rows.subarray(y * stride + 1 + x * 3, y * stride + 4 + x * 3)];
  return { width, height, bitDepth, colorType, rows, pixel };
}

test("the manifest offers 192 and 512 icons and a separate maskable icon, all valid opaque PNGs of the stated size", () => {
  for (const icon of manifest.icons) {
    expect(icon.type, icon.src).toBe("image/png");
    const png = readPng(icon.src);
    expect(`${png.width}x${png.height}`, icon.src).toBe(icon.sizes);
    expect([png.bitDepth, png.colorType], icon.src).toEqual([8, 2]);
  }
  const has = (sizes: string, purpose: string) => manifest.icons.filter((i) => i.sizes === sizes && i.purpose === purpose);
  expect(has("192x192", "any")).toHaveLength(1);
  expect(has("512x512", "any")).toHaveLength(1);
  const [maskable] = has("512x512", "maskable");
  expect(maskable).toBeDefined();
  expect(manifest.icons.filter((i) => i.purpose !== "maskable").map((i) => i.src)).not.toContain(maskable.src);
});

test("the Apple touch icon in the page metadata is a valid 180x180 PNG", async () => {
  const meta = await generateMetadata({ params: Promise.resolve({ lang: "sw" }) });
  const icons = meta.icons as { icon: string; apple: string };
  expect(icons.icon).toBe("/logo.svg");
  const png = readPng(icons.apple);
  expect([png.width, png.height]).toEqual([180, 180]);
});

test("every icon is the header's Bitsacco mark, reproduced pixel for pixel from public/logo.svg", () => {
  const d = logoPath(text("public/logo.svg"));
  // The header draws the same path, cropped to the same box, in the same colours.
  const header = text("components/layout/BitsaccoLogo.tsx");
  expect(header).toContain(`d="${d}"`);
  expect(header).toContain(`"${MARK_VIEWBOX.join(" ")}"`);
  expect(text("app/globals.css")).toContain(`--color-night: ${BACKGROUND};`);
  expect(text("app/globals.css")).toContain(`--color-teal-200: ${FOREGROUND};`);
  expect(text("components/layout/BrandLockup.tsx")).toContain("text-teal-200");
  expect(manifest.background_color, "splash screen matches the icon background").toBe(BACKGROUND);

  const referenced = [...manifest.icons.map((i) => i.src), "/icons/jifunze-apple-touch-180.png"];
  expect(new Set(referenced)).toEqual(new Set(ICONS.map((i) => `/icons/${i.file}`)));
  for (const { file, size, scale } of ICONS) {
    expect(readPng(`/icons/${file}`).rows.equals(renderRows(d, size, scale)), file).toBe(true);
  }
});

test("the mark is never cropped: the maskable icon keeps it inside the 40% safe zone, the others inside their edges", () => {
  const bg = rgb(BACKGROUND);
  for (const icon of manifest.icons) {
    const png = readPng(icon.src);
    const c = png.width / 2;
    const limit = icon.purpose === "maskable" ? 0.4 * png.width : c;
    let outside = 0;
    let inside = 0;
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        const isBg = png.pixel(x, y).every((v, k) => v === bg[k]);
        const beyond = icon.purpose === "maskable" ? Math.hypot(x + 0.5 - c, y + 0.5 - c) > limit : x === 0 || y === 0 || x === png.width - 1 || y === png.height - 1;
        if (beyond && !isBg) outside++;
        if (!isBg) inside++;
      }
    }
    expect(outside, `${icon.src}: mark pixels outside the safe area`).toBe(0);
    expect(inside, `${icon.src}: the mark is drawn`).toBeGreaterThan(png.width * png.height * 0.1);
  }
});
