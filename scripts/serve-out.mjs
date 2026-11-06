// Static server for the built site (out/), used by the browser tests: node scripts/serve-out.mjs [dir] [port]
// With API_PROXY=http://127.0.0.1:4351 it also streams /api/* to the API there, as nginx does in the container.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? 4321);
const apiProxy = process.env.API_PROXY ? new URL(process.env.API_PROXY) : null;
const types = {
  ".pdf": "application/pdf",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".woff2": "font/woff2",
};

// Like the nginx /api/ location: the client's X-Real-IP is replaced, and /api/internal/ is never reachable.
function proxyApi(req, res, pathname) {
  if (pathname.startsWith("/api/internal/")) {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" }).end('{"error":{"code":"not_found","message_sw":"Hatukupata ukurasa au kitu ulichotafuta.","message_en":"We could not find what you were looking for."}}');
    return;
  }
  const upstream = http.request(
    { protocol: apiProxy.protocol, hostname: apiProxy.hostname, port: apiProxy.port, method: req.method, path: req.url, headers: { ...req.headers, "x-real-ip": "127.0.0.1" } },
    (upRes) => {
      res.writeHead(upRes.statusCode ?? 502, upRes.headers);
      upRes.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502).end();
    else res.destroy();
  });
  req.pipe(upstream);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (apiProxy && url.pathname.startsWith("/api/")) {
      proxyApi(req, res, url.pathname);
      return;
    }
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "content-type": types[".html"] });
      fs.createReadStream(path.join(root, "404.html")).pipe(res);
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`serving ${root} on http://localhost:${port}${apiProxy ? `, /api/ to ${apiProxy.origin}` : ""}`));
