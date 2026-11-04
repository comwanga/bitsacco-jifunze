import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { beforeAll, describe, expect, test } from "vitest";
import { buildCsp, injectCsp, inlineScriptHashes } from "../../lib/build/csp.ts";
import { internalRefs, resolvesInOut } from "../../lib/build/links.ts";
import { pageWeight } from "../../lib/build/budget.ts";

const sha = (s: string) => `'sha256-${crypto.createHash("sha256").update(s, "utf8").digest("base64")}'`;

describe("csp", () => {
  test("hashes inline scripts only, not external ones", () => {
    const html = '<head></head><body><script>alert(1)</script><script src="/_next/a.js"></script><script id="x">b()</script></body>';
    expect(inlineScriptHashes(html)).toEqual([sha("alert(1)"), sha("b()")]);
  });
  test("buildCsp allows only self plus the given hashes for scripts", () => {
    const csp = buildCsp([sha("a")]);
    expect(csp).toContain(`script-src 'self' ${sha("a")}`);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });
  test("injectCsp puts exactly one CSP meta first in <head>", () => {
    const out = injectCsp('<html><head><meta charset="utf-8"><script>x()</script></head></html>', "default-src 'self'");
    expect(out.match(/http-equiv="Content-Security-Policy"/g)).toHaveLength(1);
    expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("<script>"));
    expect(injectCsp(out, "default-src 'self'").match(/Content-Security-Policy/g)).toHaveLength(1);
  });
});

describe("links and budget", () => {
  let out: string;
  beforeAll(() => {
    out = fs.mkdtempSync(path.join(os.tmpdir(), "jifunze-out-"));
    fs.mkdirSync(path.join(out, "sw/savers"), { recursive: true });
    fs.mkdirSync(path.join(out, "_next/static/chunks"), { recursive: true });
    fs.writeFileSync(path.join(out, "sw/index.html"), "<p>home</p>");
    fs.writeFileSync(path.join(out, "404.html"), "nope");
    fs.writeFileSync(path.join(out, "_next/static/chunks/a.js"), "console.log('a');".repeat(50));
    fs.writeFileSync(path.join(out, "_next/static/chunks/s.css"), "body{color:red}".repeat(50));
    fs.writeFileSync(
      path.join(out, "sw/savers/index.html"),
      '<link rel="stylesheet" href="/_next/static/chunks/s.css"><script src="/_next/static/chunks/a.js"></script><a href="/sw/">h</a>',
    );
  });

  test("internalRefs ignores external links, protocol-relative links and fragments", () => {
    const refs = internalRefs('<a href="https://x.org/">x</a><a href="//cdn.x/y">y</a><a href="#top">t</a><a href="/sw/glossary/#sats">g</a><img src="/logo.svg">');
    expect(refs).toEqual(["/sw/glossary/#sats", "/logo.svg"]);
  });
  test("internalRefs skips /api/ refs, which the API serves, but still reports missing pages", () => {
    const refs = internalRefs(
      '<a href="/api/auth/github/start?purpose=signin&amp;lang=sw&amp;return=/sw/account/">g</a><a href="/api/me">m</a><a href="/sw/x/">x</a><a href="/apiary/">a</a>',
    );
    expect(refs).toEqual(["/sw/x/", "/apiary/"]);
    expect(refs.filter((r) => r.startsWith("/api/"))).toEqual([]);
    expect(resolvesInOut(out, "/sw/x/")).toBe(false);
  });
  test("resolvesInOut finds directories, files and .html pages", () => {
    expect(resolvesInOut(out, "/sw/")).toBe(true);
    expect(resolvesInOut(out, "/sw/glossary/#x")).toBe(false);
    expect(resolvesInOut(out, "/404")).toBe(true);
    expect(resolvesInOut(out, "/_next/static/chunks/a.js?v=1")).toBe(true);
  });
  test("pageWeight skips noModule polyfills (modern browsers never download them) and decodes encoded paths", () => {
    fs.mkdirSync(path.join(out, "_next/static/chunks/[lang]"), { recursive: true });
    fs.writeFileSync(path.join(out, "_next/static/chunks/[lang]/p.js"), "var p=1;".repeat(40));
    fs.writeFileSync(path.join(out, "_next/static/chunks/poly.js"), "var poly=1;".repeat(400));
    const page = path.join(out, "sw/enc.html");
    fs.writeFileSync(page, '<script src="/_next/static/chunks/%5Blang%5D/p.js"></script><script src="/_next/static/chunks/poly.js" noModule=""></script>');
    const gz = (f: string) => zlib.gzipSync(fs.readFileSync(path.join(out, f))).length;
    expect(pageWeight(out, page).jsGzip).toBe(gz("_next/static/chunks/[lang]/p.js"));
  });
  test("pageWeight sums gzip of the page and the css/js it loads", () => {
    const gz = (f: string) => zlib.gzipSync(fs.readFileSync(path.join(out, f))).length;
    const w = pageWeight(out, path.join(out, "sw/savers/index.html"));
    expect(w.jsGzip).toBe(gz("_next/static/chunks/a.js"));
    expect(w.totalGzip).toBe(gz("sw/savers/index.html") + gz("_next/static/chunks/a.js") + gz("_next/static/chunks/s.css"));
  });
});
