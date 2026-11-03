// Spike: can a GitHub App installation token read the PUBLIC contribution data Phase 3 needs, across repos
// outside the installation? Compares each query with a reference token (your own `gh auth token`).
//
// Needs a TEST GitHub App with NO permissions, installed on your own account only:
//   GH_APP_ID=123 GH_APP_KEY=path/to/private-key.pem GH_INSTALLATION_ID=456 \
//   GH_REFERENCE_TOKEN="$(gh auth token)" SAMPLE_LOGIN=comwanga node installation-search.mjs
// Read-only: only GET requests to public data. The key and tokens are never printed.
import crypto from "node:crypto";
import fs from "node:fs";

const { GH_APP_ID, GH_APP_KEY, GH_INSTALLATION_ID, GH_REFERENCE_TOKEN, SAMPLE_LOGIN = "comwanga" } = process.env;
if (!GH_APP_ID || !GH_APP_KEY || !GH_INSTALLATION_ID || !GH_REFERENCE_TOKEN) {
  console.error("Set GH_APP_ID, GH_APP_KEY, GH_INSTALLATION_ID and GH_REFERENCE_TOKEN (see header).");
  process.exit(2);
}
const b64url = (b) => Buffer.from(b).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: GH_APP_ID }))}`;
const jwt = `${unsigned}.${b64url(crypto.sign("RSA-SHA256", Buffer.from(unsigned), fs.readFileSync(GH_APP_KEY)))}`;

const api = async (path, token, scheme = "Bearer", method = "GET") => {
  const r = await fetch(`https://api.github.com${path}`, { method, headers: { Authorization: `${scheme} ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "jifunze-spike" } });
  return { status: r.status, body: await r.json().catch(() => null), remaining: r.headers.get("x-ratelimit-remaining") };
};
const inst = await api(`/app/installations/${GH_INSTALLATION_ID}/access_tokens`, jwt, "Bearer", "POST");
if (inst.status !== 201) { console.error("could not mint installation token:", inst.status, inst.body?.message); process.exit(1); }
const itok = inst.body.token;
console.log("installation token permissions:", JSON.stringify(inst.body.permissions), "repository_selection:", inst.body.repository_selection);

const q = (s) => `/search/issues?q=${encodeURIComponent(s)}&per_page=5`;
const cases = [
  ["PRs authored (public, any repo)", q(`is:pr author:${SAMPLE_LOGIN}`)],
  ["PRs merged", q(`is:pr is:merged author:${SAMPLE_LOGIN}`)],
  ["PRs outside own repos", q(`is:pr author:${SAMPLE_LOGIN} -user:${SAMPLE_LOGIN}`)],
  ["Public repo outside installation: bitcoin/bitcoin merged PRs", q("repo:bitcoin/bitcoin is:pr is:merged")],
  ["PRs reviewed by the sample account (any public repo)", q(`is:pr reviewed-by:${SAMPLE_LOGIN} -author:${SAMPLE_LOGIN}`)],
];
let pass = true;
for (const [name, path] of cases) {
  const [a, b] = await Promise.all([api(path, itok), api(path, GH_REFERENCE_TOKEN)]);
  const same = a.status === 200 && b.status === 200 && a.body.total_count === b.body.total_count;
  pass &&= same;
  console.log(`${same ? "SAME" : "DIFF"}  ${name}: installation ${a.status} total=${a.body?.total_count ?? a.body?.message}  reference ${b.status} total=${b.body?.total_count}`);
}
// Per-PR review submissions in a public repo outside the installation.
const pr = await api(q("repo:bitcoin/bitcoin is:pr is:merged comments:>20").replace("per_page=5", "per_page=1"), GH_REFERENCE_TOKEN);
const n = pr.body.items[0].number;
const [ra, rb] = await Promise.all([api(`/repos/bitcoin/bitcoin/pulls/${n}/reviews?per_page=100`, itok), api(`/repos/bitcoin/bitcoin/pulls/${n}/reviews?per_page=100`, GH_REFERENCE_TOKEN)]);
const sameReviews = ra.status === 200 && rb.status === 200 && ra.body.length === rb.body.length;
pass &&= sameReviews;
console.log(`${sameReviews ? "SAME" : "DIFF"}  reviews on bitcoin/bitcoin#${n}: installation ${ra.status} n=${ra.body?.length}  reference ${rb.status} n=${rb.body?.length}`);
const rl = await api("/rate_limit", itok);
console.log("installation search limit:", JSON.stringify(rl.body?.resources?.search), "core:", JSON.stringify(rl.body?.resources?.core));
console.log(pass ? "\nRESULT: installation token sees the same public data. D5 holds." : "\nRESULT: installation token does NOT see the same public data. Report to maintainer; do not switch to stored user tokens.");
process.exit(pass ? 0 : 1);
