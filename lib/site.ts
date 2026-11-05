// Public build-time configuration only. API secrets must never be passed to the web build.
const configuredOrigin = process.env.SITE_ORIGIN || "https://bitsaccojifunze.xyz";
const origin = new URL(configuredOrigin);
const localHttp = origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
if (origin.origin !== configuredOrigin || (origin.protocol !== "https:" && !localHttp)) {
  throw new Error("SITE_ORIGIN must be an exact HTTPS origin (HTTP is allowed only for local testing)");
}
export const SITE_URL = origin.origin;
export const SITE_INDEXABLE = SITE_URL === "https://bitsaccojifunze.xyz";
// The initial public release is anonymous. Staging/local account acceptance stays separate.
export const ACCOUNTS_AVAILABLE = !SITE_INDEXABLE;
export const REPO_URL = "https://github.com/comwanga/bitsacco-jifunze";
