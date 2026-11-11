import { loadTesterAllowlist, type TesterAllowlist } from "./allowlist.ts";

export type Config = {
  siteOrigin: string;
  port: number;
  databaseUrl: string;
  /** False when no GitHub App is configured: the GitHub routes are then not mounted at all. */
  githubEnabled: boolean;
  githubClientId: string;
  githubClientSecret: string;
  githubOAuthBase: string;
  githubApiBase: string;
  peppers: Map<number, Buffer>;
  currentPepper: number;
  /** Null: no tester restriction. Otherwise only these identities may authenticate. */
  testerAllowlist: TesterAllowlist | null;
  /** Keys whose malformed values made the allowlist deny everyone. */
  testerAllowlistInvalid: string[];
};

const REQUIRED = ["SITE_ORIGIN", "DATABASE_URL"] as const;

// Errors name keys only, never values.
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const missing: string[] = REQUIRED.filter((k) => !env[k]);

  // GitHub is optional, but half a credential is a mistake, not a choice.
  const githubEnabled = Boolean(env.GITHUB_CLIENT_ID) && Boolean(env.GITHUB_CLIENT_SECRET);
  if (Boolean(env.GITHUB_CLIENT_ID) !== Boolean(env.GITHUB_CLIENT_SECRET)) {
    missing.push(env.GITHUB_CLIENT_ID ? "GITHUB_CLIENT_SECRET" : "GITHUB_CLIENT_ID");
  }

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

  const testers = loadTesterAllowlist(env);

  return {
    siteOrigin: env.SITE_ORIGIN as string,
    port,
    databaseUrl: env.DATABASE_URL as string,
    githubEnabled,
    githubClientId: env.GITHUB_CLIENT_ID ?? "",
    githubClientSecret: env.GITHUB_CLIENT_SECRET ?? "",
    githubOAuthBase: env.GITHUB_OAUTH_BASE || "https://github.com",
    githubApiBase: env.GITHUB_API_BASE || "https://api.github.com",
    peppers,
    currentPepper: Math.max(...peppers.keys()),
    testerAllowlist: testers.allowlist,
    testerAllowlistInvalid: testers.invalid,
  };
}
