// Test only: the fake GitHub for the account browser tests (playwright.account.config.ts), on 127.0.0.1.
// It is a stand-in that authenticates no one; the API itself has no test or control endpoints.
import { startFakeGithub } from "./fake-github.ts";

const env = process.env;
const site = env.SITE_ORIGIN ?? "http://localhost:4352";
const fake = await startFakeGithub({
  clientId: env.GITHUB_CLIENT_ID ?? "e2e-fake-client-id",
  clientSecret: env.GITHUB_CLIENT_SECRET ?? "e2e-fake-client-secret",
  port: Number(env.FAKE_GITHUB_PORT ?? 4350),
  consent: true,
  // The three callbacks a real GitHub App must register, one per purpose.
  redirectUris: ["", "/reauth", "/replace"].map((p) => `${site}/api/auth/github/callback${p}`),
});
console.log(`fake GitHub (test only) on ${fake.url}`);

const stop = () => void fake.close().then(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
