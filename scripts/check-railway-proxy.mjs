// Synthetic ingress contract checks. This does NOT prove Railway's real edge behavior or log redaction.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const root = path.resolve(".");
const name = `jifunze-railway-check-${Date.now()}`;
const fixture = path.join(root, ".superpowers", name);
fs.mkdirSync(fixture, { recursive: true });
const nginx = "nginxinc/nginx-unprivileged:stable-alpine";
const containers = [];
let network = false, checks = 0;
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
const mount = (source, target) => ["--mount", `type=bind,source=${source},target=${target},readonly`];
function run(suffix, args, image = nginx, command = []) {
  const id = `${name}-${suffix}`;
  containers.push(id);
  docker("run", "-d", "--name", id, "--network", name, "--memory=96m", ...args, image, ...command);
  return id;
}
const ip = id => JSON.parse(docker("inspect", "--format", "{{json .NetworkSettings.Networks}}", id))[name].IPAddress;
const equal = (got, want, label) => { if (got !== want) throw new Error(`${label}: expected ${want}, got ${got}`); checks++; console.log(`ok ${label}`); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Two stand-ins: the current API answers the tester gate (GET only, as the real route does); a stale one has no such route.
const echo = gate => `import http from 'node:http';http.createServer((req,res)=>{${gate}res.setHeader('Content-Type','application/json');`;
fs.writeFileSync(path.join(fixture, "api-stale.mjs"), `${echo(`if(req.url==='/api/internal/tester-gate'){res.statusCode=404;return res.end();}`)}res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({peer:req.socket.remoteAddress,stale:true}));}).listen(3001,'::');`);
fs.writeFileSync(path.join(fixture, "api.mjs"), `${echo(`if(req.url==='/api/internal/tester-gate'){res.statusCode=req.method==='GET'&&!req.headers.cookie&&!req.headers.authorization?204:405;return res.end();}`)}res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({peer:req.socket.remoteAddress,ip:req.headers['x-real-ip'],proto:req.headers['x-forwarded-proto'],xff:req.headers['x-forwarded-for']||'',forwarded:req.headers.forwarded||''}));}).listen(3001,'::');`);
fs.writeFileSync(path.join(fixture, "front.conf"), `server { listen 8080; access_log off; resolver 127.0.0.11 ipv6=off; location / { set $web http://web:8080; proxy_pass $web; proxy_set_header Host $http_host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-Proto https; } }`);
fs.writeFileSync(path.join(fixture, "index.html"), "<!doctype html><title>Synthetic static learning</title><p>Learning remains available</p>");

try {
  const subnet = `fd42:173:654:${(Date.now() % 65536).toString(16)}::/64`;
  docker("network", "create", "--internal", "--ipv6", "--subnet", subnet, name); network = true;
  const api = run("api", ["--network-alias", "api.railway.internal", ...mount(path.join(fixture, "api.mjs"), "/fixture.mjs")], "node:24.22.2-alpine3.24", ["node", "/fixture.mjs"]);
  const front = run("front", ["--network-alias", "front", ...mount(path.join(fixture, "front.conf"), "/etc/nginx/conf.d/default.conf")]);
  const a = run("a", [], nginx, ["sleep", "infinity"]);
  const b = run("b", [], nginx, ["sleep", "infinity"]);
  const common = ["--network-alias", "web", "-e", "JIFUNZE_HOSTING=railway", "-e", "NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1", "-e", "API_HOST=api.railway.internal",
    ...mount(path.join(root, "docker/nginx.conf"), "/fixture/nginx.conf"),
    ...mount(path.join(root, "docker/nginx.conf"), "/etc/nginx/jifunze-base.conf"),
    ...mount(path.join(root, "docker/security-headers.conf"), "/etc/nginx/snippets/security-headers.conf"),
    ...mount(path.join(root, "docker/railway-entrypoint.sh"), "/docker-entrypoint.d/19-jifunze-railway.sh"),
    ...mount(path.join(fixture, "index.html"), "/usr/share/nginx/html/index.html"),
    ...mount(path.join(fixture, "index.html"), "/usr/share/nginx/html/_next/static/check/index.html"),
    "--entrypoint", "sh"];
  const command = ["-c", 'cp /fixture/nginx.conf /etc/nginx/conf.d/default.conf && sh /docker-entrypoint.sh nginx -g "daemon off;"'];
  let web;
  function startWeb(enabled, model = "") {
    return run(`web-${enabled}`, [...common, "-e", `STAGING_AUTH_ENABLED=${enabled}`, "-e", `RAILWAY_TRUST_MODEL=${model}`,
      "-e", "RAILWAY_ENVIRONMENT_NAME=staging", "-e", "SITE_ORIGIN=https://staging.bitsaccojifunze.xyz"], nginx, command);
  }
  const CANONICAL = "Host: staging.bitsaccojifunze.xyz";
  const GENERATED = "Host: web-staging-d337.up.railway.app";
  const request = (client, target, url, headers = [], method = "GET") => {
    // The public edge passes the requested hostname on; requests are for the canonical one unless a test says otherwise.
    const all = headers.some(h => /^host:/i.test(h)) ? headers : [CANONICAL, ...headers];
    const result = docker("exec", client, "curl", "--ipv4", "--path-as-is", "--max-time", "8", "-sS", "-X", method, "-w", "\n%{http_code}", ...all.flatMap(h => ["-H", h]), `http://${target}:8080${url}`);
    const at = result.lastIndexOf("\n");
    return { status: Number(result.slice(at + 1)), body: result.slice(0, at) };
  };
  async function ready() {
    for (let n = 0; n < 50; n++) {
      try { if (request(a, "web", "/api/health").status === 200) return; } catch {}
      await sleep(100);
    }
    throw new Error("nginx health did not become ready");
  }
  web = startWeb(0); await ready();
  equal(request(a, "front", "/").status, 200, "static site starts with authentication disabled");
  // Inspect nginx itself: the stand-in front speaks HTTP and can expand relative Location headers.
  const directoryHeaders = docker("exec", a, "curl", "-sSI", "http://web:8080/_next/static/check");
  fs.writeFileSync(path.join(fixture, "directory-headers.txt"), directoryHeaders);
  equal(/^location: \/_next\/static\/check\/\s*$/im.test(directoryHeaders), true, "nginx directory redirects remain relative for the public HTTPS edge");
  equal(request(a, "front", "/api/auth/nostr/challenge", [], "POST").status, 503, "authentication is closed before ingress acceptance");
  const closedHeaders = docker("exec", a, "curl", "-sSI", "-H", CANONICAL, "http://front:8080/api/auth/nostr/challenge");
  equal(/cache-control: no-store/i.test(closedHeaders), true, "disabled authentication responses remain no-store");
  equal(request(a, "front", "/api/internal/visibility").status, 404, "internal routes remain hidden");
  const disabledHeaders = docker("exec", a, "curl", "-sSI", "-H", CANONICAL, "http://front:8080/");
  equal(/x-robots-tag: noindex, nofollow/i.test(disabledHeaders), true, "staging HTTP responses prohibit indexing");
  equal(/^strict-transport-security: max-age=86400\s*$/im.test(disabledHeaders), true, "static pages send HSTS limited to this host for one day");
  equal(/^strict-transport-security: max-age=86400\s*$/im.test(closedHeaders), true, "API responses send the same HSTS policy");
  const generatedClosed = request(a, "front", "/api/me", [GENERATED]);
  equal(generatedClosed.status, 404, "generated hostname has no account API while authentication is disabled");
  equal(JSON.parse(generatedClosed.body).error.code, "not_found", "generated hostname answers in the API's error shape");
  equal(request(a, "front", "/", [GENERATED]).status, 200, "public learning content stays available on the generated hostname");
  equal(request(a, "front", "/api/health", [GENERATED]).status, 200, "health stays available on the generated hostname");
  docker("rm", "-f", web);
  web = startWeb(1, "isolated-staging"); await ready();
  const spoof = ["X-Real-IP: 203.0.113.99", "X-Forwarded-For: 203.0.113.98", "Forwarded: for=203.0.113.97", "X-Forwarded-Proto: http"];
  const first = request(a, "front", "/api/me", spoof);
  equal(first.status, 200, "normalized front request reaches API in explicit environment trust mode");
  const info = JSON.parse(first.body);
  const apiHeaders = docker("exec", a, "curl", "-sSI", "-H", CANONICAL, "http://front:8080/api/me");
  equal((apiHeaders.match(/cache-control: no-store/gi) || []).length, 1, "proxied account responses have one no-store policy");
  equal(/^f[cd]/i.test(info.peer), true, "upstream uses private IPv6, preserving the API's existing trusted-peer policy");
  equal(info.ip, ip(a), "forged public forwarding headers cannot change client identity");
  equal(info.proto, "https", "API receives the public HTTPS protocol");
  equal(info.xff, "", "untrusted X-Forwarded-For is removed");
  equal(info.forwarded, "", "untrusted Forwarded is removed");
  const second = JSON.parse(request(b, "front", "/api/me").body);
  equal(second.ip, ip(b), "second client retains its own identity");
  equal(second.ip !== info.ip, true, "clients cannot collapse into the front proxy's shared address");
  docker("restart", web); await ready();
  equal(JSON.parse(request(a, "front", "/api/me").body).ip, ip(a), "web restart renders the same configuration without duplicating directives");
  const directHeaders = ["X-Real-IP: 203.0.113.99", "X-Forwarded-Proto: https"];
  equal(JSON.parse(request(a, "web", "/api/me", directHeaders).body).ip, "203.0.113.99", "residual boundary: trusted private co-tenant can supply a valid address directly");
  for (const value of ["", "unknown", "1.2.3.999", "01.2.3.4", "1.2.3.4:80", "1.2.3.4, 5.6.7.8", "[2001:db8::1]", "[2001:db8::1]:80", "2001:::1", "fe80::1%eth0", "::ffff:01.2.3.4"]) {
    equal(request(a, "web", "/api/me", [`X-Real-IP: ${value}`, "X-Forwarded-Proto: https"]).status, 403, `invalid or ambiguous forwarded address rejected: ${value || "missing"}`);
  }
  equal(request(a, "web", "/api/me", ["X-Real-IP: 203.0.113.1", "X-Real-IP: 203.0.113.2", "X-Forwarded-Proto: https"]).status, 403, "duplicate client-address headers rejected");
  equal(request(a, "web", "/api/me", ["X-Real-IP: 203.0.113.1", "X-Real-IP: 203.0.113.1", "X-Forwarded-Proto: https"]).status, 403, "identical duplicate client-address headers rejected");
  equal(request(a, "web", "/api/me", ["X-Real-IP: 203.0.113.1", "X-Forwarded-Proto: http"]).status, 403, "unexpected forwarded protocol rejected");
  equal(request(a, "web", "/api/me", ["X-Real-IP: 203.0.113.1", "X-Forwarded-Proto: https, http"]).status, 403, "ambiguous forwarded protocol rejected");
  equal(request(a, "web", "/api/me", [`X-Real-IP: ${ip(a)}`, "X-Forwarded-Proto: https"]).status, 403, "unchanged socket address fails closed");
  // nginx emits canonical mapped IPv6; the unchanged API normaliseIp collapses it to IPv4.
  for (const [value, canonical] of [["2001:0DB8:0000:0000:0000:0000:0000:0001", "2001:db8::1"], ["::ffff:203.0.113.5", "::ffff:203.0.113.5"]]) {
    equal(JSON.parse(request(a, "web", "/api/me", [`X-Real-IP: ${value}`, "X-Forwarded-Proto: https"]).body).ip, canonical, "nginx emits a canonical numeric address");
  }
  equal(request(a, "web", "/api/internal/visibility", spoof).status, 404, "direct internal route stays hidden");
  const marker = "JF_SYNTHETIC_OAUTH_MARKER";
  equal(request(a, "front", `/api/auth/github/callback?code=${marker}&state=${marker}`).status, 200, "callback reaches upstream");
  // With authentication on, the generated hostname must never reach an authentication route: the echo upstream
  // answers 200 to anything, so any status but 404 here would be a bypass.
  for (const [path, method] of [["/api/me", "GET"], ["/api/auth/github/start?purpose=signin&lang=sw", "GET"], [`/api/auth/github/callback?code=${marker}&state=${marker}`, "GET"], [`/api/auth/github/callback/reauth?code=${marker}&state=${marker}`, "GET"], [`/api/auth/github/callback/replace?code=${marker}&state=${marker}`, "GET"], ["/api/auth/nostr/challenge", "POST"], ["/api/auth/nostr/verify", "POST"], ["/api/auth/recovery", "POST"], ["/api/auth/logout", "POST"]]) {
    const denied = request(a, "front", path, [GENERATED], method);
    equal(denied.status, 404, `generated hostname cannot reach ${method} ${path.split("?")[0]}`);
    equal(denied.body.includes("peer"), false, `upstream never sees ${method} ${path.split("?")[0]} from the generated hostname`);
  }
  // nginx compares the normalized path but forwards the raw one, so a path must not look like health and be something else.
  for (const path of ["/api/health/../me", "/api/health/%2e%2e/me", "/api/health%2F..%2Fme", "//api/me", "/api/./me", "/api/internal/../me", "/api/health/", "/api/health;x", "/api/health/..\\me"]) {
    equal(request(a, "front", path, [GENERATED]).body.includes("peer"), false, `path variant cannot reach the API from the generated hostname: ${path}`);
  }
  for (const host of ["staging.bitsaccojifunze.xyz.evil.example", "evil.example", "xstaging.bitsaccojifunze.xyz"]) {
    equal(request(a, "front", "/api/me", [`Host: ${host}`]).status, 404, `lookalike or unknown hostname refused: ${host}`);
  }
  equal(request(a, "front", "/api/me", ["Host: STAGING.BITSACCOJIFUNZE.XYZ"]).status, 200, "hostname comparison follows nginx's case-insensitive normalization");
  equal(request(a, "front", "/api/health", [GENERATED]).status, 200, "health stays available on the generated hostname with authentication on");
  docker("stop", api);
  equal(request(a, "front", "/").status, 200, "learning remains available without API");
  equal([500, 502, 504].includes(request(a, "front", `/api/auth/github/callback/reauth?code=${marker}&state=${marker}`).status), true, "callback upstream failure is visible");
  equal(request(a, "front", "/api/auth/nostr/verify", ["Authorization: Nostr fixture"], "POST").body.includes("peer"), false, "account request fails visibly while the API is down");
  // A deployment without the allowlist, such as one built from main: authentication must stay closed.
  run("api-stale", ["--network-alias", "api.railway.internal", ...mount(path.join(fixture, "api-stale.mjs"), "/fixture.mjs")], "node:24.22.2-alpine3.24", ["node", "/fixture.mjs"]);
  await sleep(12000); // nginx re-resolves the API's name after its 10-second validity
  equal(docker("exec", a, "curl", "--max-time", "5", "-sS", "http://api.railway.internal:3001/api/me").includes('"stale":true'), true, "the stale API is up and would answer if it were reached");
  for (const [target, method] of [["/api/me", "GET"], ["/api/auth/github/start?purpose=signin&lang=sw", "GET"], [`/api/auth/github/callback?code=${marker}&state=${marker}`, "GET"], ["/api/auth/nostr/challenge", "POST"], ["/api/auth/nostr/verify", "POST"], ["/api/auth/recovery", "POST"]]) {
    const refused = request(a, "front", target, [], method);
    equal(refused.status >= 500 && !refused.body.includes("stale"), true, `stale API cannot serve ${method} ${target.split("?")[0]} with authentication enabled`);
  }
  equal(request(a, "front", "/").status, 200, "learning remains available with a stale API");
  const logResult = spawnSync("docker", ["logs", web], { encoding: "utf8", windowsHide: true });
  equal(logResult.status, 0, "both nginx log streams are readable");
  const logs = logResult.stdout + logResult.stderr;
  equal(logs.includes(marker), false, "nginx logs omit synthetic callback secrets on success and upstream failure");
  for (const extra of [[], ["RAILWAY_TRUST_MODEL=anything"], ["RAILWAY_TRUST_MODEL=isolated-staging", "RAILWAY_ENVIRONMENT_NAME=production"], ["RAILWAY_TRUST_MODEL=isolated-staging", "RAILWAY_ENVIRONMENT_NAME=staging", "SITE_ORIGIN=http://staging.bitsaccojifunze.xyz"], ["RAILWAY_TRUST_MODEL=isolated-staging", "RAILWAY_ENVIRONMENT_NAME=staging", "SITE_ORIGIN=https://staging.bitsaccojifunze.xyz", "TRUSTED_PROXY_CIDRS=100.64.0.0/24"]]) {
    const result = spawnSync("docker", ["run", "--rm", "--network", name, "--memory=64m", ...common,
      "-e", "STAGING_AUTH_ENABLED=1", ...extra.flatMap(v => ["-e", v]), "-e", "NGINX_LOCAL_RESOLVERS=127.0.0.11",
      nginx, "-c", "cp /fixture/nginx.conf /etc/nginx/conf.d/default.conf && sh /docker-entrypoint.d/19-jifunze-railway.sh"], { encoding: "utf8", windowsHide: true });
    equal(result.status !== 0, true, "missing, unexpected, production or contradictory trust configuration fails closed");
  }
  for (const origin of [[], ["-e", "SITE_ORIGIN=http://staging.bitsaccojifunze.xyz"], ["-e", "SITE_ORIGIN=https://staging.bitsaccojifunze.xyz/"], ["-e", 'SITE_ORIGIN=https://a"; evil']]) {
    const result = spawnSync("docker", ["run", "--rm", "--network", name, "--memory=64m", ...common,
      "-e", "STAGING_AUTH_ENABLED=0", ...origin, "-e", "NGINX_LOCAL_RESOLVERS=127.0.0.11",
      nginx, "-c", "cp /fixture/nginx.conf /etc/nginx/conf.d/default.conf && sh /docker-entrypoint.d/19-jifunze-railway.sh"], { encoding: "utf8", windowsHide: true });
    equal(result.status !== 0, true, "a canonical hostname cannot be derived, so Railway mode refuses to start even with authentication disabled");
  }
  console.log(`check-railway-proxy: ${checks} checks passed; actual Railway ingress remains unverified`);
} catch (error) {
  for (const id of containers) {
    const log = spawnSync("docker", ["logs", id], { encoding: "utf8", windowsHide: true });
    fs.writeFileSync(path.join(fixture, `${id}.log`), (log.stdout || "") + (log.stderr || ""));
  }
  throw error;
} finally {
  for (const id of containers.reverse()) { try { docker("rm", "-f", id); } catch {} }
  if (network) { try { docker("network", "rm", name); } catch {} }
  // Keep the harmless fixtures as local engineering evidence; no test resource or public port remains.
}
