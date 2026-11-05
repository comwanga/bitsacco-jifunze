// Exercise the production entrypoint and final export in the actual nginx runner image, with no API.
// --keep retains only this local test container for sequential browser suites on port 4323.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
const name = "jifunze-public-release-check";
const image = "nginxinc/nginx-unprivileged:stable-alpine";
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
const mount = (source, target) => ["--mount", `type=bind,source=${path.resolve(source)},target=${target},readonly`];
const common = ["--memory=96m", "--cpus=0.25", "-e", "JIFUNZE_HOSTING=railway", "-e", "JIFUNZE_SITE_MODE=static", "-e", "RAILWAY_ENVIRONMENT_NAME=production", "-e", "SITE_ORIGIN=https://bitsaccojifunze.xyz",
  ...mount("out", "/usr/share/nginx/html"), ...mount("docker/nginx.conf", "/etc/nginx/jifunze-base.conf"),
  ...mount("docker/security-headers.conf", "/etc/nginx/snippets/security-headers.conf"), ...mount("docker/railway-entrypoint.sh", "/release-entrypoint.sh"), "--entrypoint", "sh"];
let running = false, passed = false, checks = 0;
function check(condition, label) { if (!condition) throw Error(label); checks++; }
try {
  docker("run", "-d", "--name", name, "-p", "127.0.0.1:4323:8080", ...common, image, "-c", 'sh /release-entrypoint.sh && exec nginx -g "daemon off;"');
  running = true;
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { ready = (await fetch("http://localhost:4323/en/")).ok; } catch {}
    if (ready) break;
    await new Promise(r => setTimeout(r, 200));
  }
  check(ready, "production nginx serves the final export");
  const config = docker("exec", name, "nginx", "-T").replace(/^\s*#.*$/gm, "");
  check(!/proxy_pass|set_real_ip_from|real_ip_header|\bresolver\s/.test(config), "static nginx has no API, DNS or proxy-trust dependency");
  for (const pathname of ["/en/", "/sw/", "/sw/savers/wallets-keys/", "/en/lightning/routing-htlcs/", "/robots.txt", "/sitemap.xml", "/sw.js", "/missing-release-page"]) {
    const r = await fetch(`http://localhost:4323${pathname}`);
    check(r.status === (pathname.includes("missing-release") ? 404 : 200), `status ${pathname}`);
    for (const h of ["content-security-policy", "x-content-type-options", "referrer-policy", "permissions-policy", "cross-origin-opener-policy", "strict-transport-security"]) check(Boolean(r.headers.get(h)), `${h} on ${pathname}`);
    check(!r.headers.has("x-robots-tag"), `no staging noindex header on ${pathname}`);
    check(!r.headers.has("set-cookie"), `no session on ${pathname}`);
  }
  for (const pathname of ["/api", "/api/", "/api/health", "/api/me", "/api/internal/tester-gate", "/api/auth/github/start", "/api/auth/github/callback?code=PUBLIC_TEST_SECRET&state=PUBLIC_TEST_SECRET", "/api/auth/nostr/challenge", "/api/auth/nostr/verify", "/api/auth/recovery", "/api/auth/logout", "//api/me", "/api/health%2f..%2fme"]) {
    for (const method of ["GET", "POST", "OPTIONS", "HEAD"]) {
      const r = await fetch(`http://localhost:4323${pathname}`, { method, headers: { host: "bitsaccojifunze.xyz" } });
      check(r.status === 404, `${method} ${pathname} blocked`);
      check(!r.headers.has("set-cookie"), `${method} ${pathname} issues no session`);
      check(r.headers.get("cache-control") === "no-store", `${method} ${pathname} not cacheable`);
    }
  }
  const redirect = await fetch("http://localhost:4323/_next/static/chunks", { redirect: "manual" });
  check(redirect.headers.get("location") === "/_next/static/chunks/", "directory redirect preserves public HTTPS at the edge");
  for (const bad of ["STAGING_AUTH_ENABLED=1", "RAILWAY_TRUST_MODEL=isolated-staging", "API_HOST=api.railway.internal", "SITE_ORIGIN=https://staging.bitsaccojifunze.xyz", "RAILWAY_ENVIRONMENT_NAME=staging", "JIFUNZE_SITE_MODE=accounts"]) {
    const result = spawnSync("docker", ["run", "--rm", "--network", "none", ...common, "-e", bad, image, "/release-entrypoint.sh"], { encoding: "utf8", windowsHide: true });
    check(result.status !== 0 && /Railway nginx configuration:/.test(result.stderr), `misconfiguration fails closed: ${bad.split("=")[0]}`);
  }
  const logs = docker("logs", name);
  check(!logs.includes("PUBLIC_TEST_SECRET"), "callback query secrets absent from logs");
  docker("restart", name);
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch("http://localhost:4323/en/")).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  check((await fetch("http://localhost:4323/api/me")).status === 404, "restart retains API isolation");
  fs.mkdirSync(".superpowers/public-release", { recursive: true });
  fs.writeFileSync(".superpowers/public-release/nginx-runtime.txt", `${checks} production runtime checks passed\n${docker("stats", "--no-stream", "--format", "{{.MemUsage}} {{.CPUPerc}}", name)}\n`);
  passed = true;
  console.log(`${checks} production nginx checks passed; ${process.argv.includes("--keep") ? `local browser target http://localhost:4323 (container ${name})` : "test container removed"}`);
} catch (error) {
  if (running) console.error(docker("logs", name));
  throw error;
} finally {
  if (running && (!passed || !process.argv.includes("--keep"))) docker("rm", "-f", name);
}
