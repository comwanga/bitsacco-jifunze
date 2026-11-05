// Check the actual Docker-built export, not only metadata helper return values.
import fs from "node:fs";
import path from "node:path";
const root = process.argv[2];
const origin = process.env.SITE_ORIGIN;
if (!root || !origin || new URL(origin).origin !== origin) throw new Error("Export directory and exact SITE_ORIGIN are required");
// The base nginx image also ships 50x.html; all server error responses are covered by X-Robots-Tag.
const html = fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith(".html") && file !== "50x.html");
if (html.length < 100) throw new Error("Incomplete static export");
for (const file of html) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  if (!/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(source)) throw new Error(`Missing staging noindex: ${file}`);
  if (source.includes("jifunze.bitsacco.com")) throw new Error(`Stale origin: ${file}`);
}
const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
if (!/^Disallow: \/\s*$/m.test(robots) || /^Allow:/m.test(robots)) throw new Error("Staging robots.txt permits indexing");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>|href="([^"]+)"/g)].map(match => match[1] || match[2]);
if (!urls.length || urls.some(url => new URL(url).origin !== origin)) throw new Error("Sitemap origin mismatch");
console.log(`Staging export: ${html.length} noindex pages, ${urls.length} sitemap/language URLs use ${origin}; robots disallow all`);
