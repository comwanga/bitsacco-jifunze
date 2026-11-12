import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.argv[2] || "out");
const origin = "https://bitsaccojifunze.xyz";
function check(condition, message) { if (!condition) throw Error(message); }
check(fs.readFileSync(path.join(root, "site-origin.txt"), "utf8").trim() === origin, "export origin marker mismatch");
const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
check(robots.includes(`Sitemap: ${origin}/sitemap.xml`) && /^Allow: \/\s*$/m.test(robots) && !robots.includes("Disallow:"), "production robots must allow indexing");
const xml = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
check(urls.length > 90, "incomplete sitemap");
for (const url of urls) {
  check(new URL(url).origin === origin, `sitemap origin mismatch: ${url}`);
  const pathname = new URL(url).pathname;
  const html = fs.readFileSync(path.join(root, pathname, "index.html"), "utf8");
  check(html.includes(`<link rel="canonical" href="${url}"`), `canonical mismatch: ${pathname}`);
  check(html.includes(`<meta property="og:url" content="${url}"`), `Open Graph mismatch: ${pathname}`);
  check(!/<meta name="robots" content="[^"]*noindex/.test(html), `education page prohibits indexing: ${pathname}`);
  for (const lang of ["en", "sw"]) {
    const translated = origin + pathname.replace(/^\/(en|sw)\//, `/${lang}/`);
    check(html.includes(`hrefLang="${lang}" href="${translated}"`), `translation mismatch: ${pathname} -> ${lang}`);
  }
}
const files = fs.readdirSync(root, { recursive: true }).filter(f => fs.statSync(path.join(root, f)).isFile());
for (const file of files.filter(f => /\.(html|js|txt|xml|json|webmanifest)$/.test(f))) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  check(!/https?:\/\/(staging\.bitsaccojifunze\.xyz|jifunze\.bitsacco\.com|www\.bitsaccojifunze\.xyz)|[a-z0-9-]+\.railway\.internal|postgres(?:ql)?:\/\/|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|gh[opsu]_[A-Za-z0-9]{30,}/.test(text), `unexpected staging/backend origin or credential pattern in ${file}`);
}
// Jifunze is account-free: no account page, sign-in control or account link may be exported.
check(!files.some(f => String(f).split(path.sep).includes("account")), "an account page was exported");
for (const file of files.filter(f => String(f).endsWith(".html"))) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  check(!html.includes('/account/"') && !html.includes("data-save-progress") && !html.includes("/api/auth/"), `account link or sign-in control in ${file}`);
}
console.log(`Public export passed: ${urls.length} indexable pages with canonical, Open Graph and matching translations; ${files.length} files; no staging/backend origins or common secret patterns; no account pages, links or sign-in controls`);
