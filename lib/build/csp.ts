import crypto from "node:crypto";

const SCRIPT_RE = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;

export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const m of html.matchAll(SCRIPT_RE)) {
    const attrs = m[1] ?? "";
    if (/\ssrc\s*=/.test(attrs)) continue;
    const digest = crypto.createHash("sha256").update(m[2], "utf8").digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

// Pages with a lab exercise may talk to the learner's own lab bridge (or their Codespace).
export const LAB_CONNECT = "http://127.0.0.1:7777 http://localhost:7777 https://*.app.github.dev";

export function buildCsp(hashes: string[], opts: { lab?: boolean; pdfReader?: boolean; nostrSignin?: boolean } = {}): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${[...new Set(hashes)].join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    opts.nostrSignin ? "connect-src 'self' wss:" : opts.lab ? `connect-src 'self' ${LAB_CONNECT}` : "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    ...(opts.pdfReader ? ["frame-src blob:"] : []),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join("; ");
}

const META_RE = /<meta http-equiv="Content-Security-Policy"[^>]*>/i;

export function injectCsp(html: string, csp: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  if (META_RE.test(html)) return html.replace(META_RE, meta);
  return html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}${meta}`);
}
