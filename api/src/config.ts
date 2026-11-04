export type Config = {
  siteOrigin: string;
  port: number;
  databaseUrl: string;
  githubClientId: string;
  githubClientSecret: string;
  githubOAuthBase: string;
  githubApiBase: string;
  peppers: Map<number, Buffer>;
  currentPepper: number;
};

const REQUIRED = ["SITE_ORIGIN", "DATABASE_URL", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"] as const;

// Errors name keys only, never values.
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const missing: string[] = REQUIRED.filter((k) => !env[k]);

  const peppers = new Map<number, Buffer>();
  const invalid: string[] = [];
  for (const key of Object.keys(env)) {
    const m = /^RECOVERY_PEPPER_V([1-9][0-9]*)$/.exec(key);
    const value = env[key];
    if (!m || !value) continue;
    const buf = Buffer.from(value, "base64");
    if (buf.length < 32) invalid.push(key);
    else peppers.set(Number(m[1]), buf);
  }
  if (!env.RECOVERY_PEPPER_V1) missing.push("RECOVERY_PEPPER_V1");

  const port = env.PORT ? Number(env.PORT) : 3001;
  if (!Number.isInteger(port) || port < 0 || port > 65535) invalid.push("PORT");

  if (missing.length > 0 || invalid.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing: ${missing.join(", ")}`);
    if (invalid.length > 0) parts.push(`invalid: ${invalid.join(", ")}`);
    throw new Error(`Configuration error (${parts.join("; ")})`);
  }

  return {
    siteOrigin: env.SITE_ORIGIN as string,
    port,
    databaseUrl: env.DATABASE_URL as string,
    githubClientId: env.GITHUB_CLIENT_ID as string,
    githubClientSecret: env.GITHUB_CLIENT_SECRET as string,
    githubOAuthBase: env.GITHUB_OAUTH_BASE || "https://github.com",
    githubApiBase: env.GITHUB_API_BASE || "https://api.github.com",
    peppers,
    currentPepper: Math.max(...peppers.keys()),
  };
}
