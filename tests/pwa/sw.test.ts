import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const src = fs.readFileSync(path.join(import.meta.dirname, "../../public/sw.js"), "utf8");
const fakeSelf = { addEventListener: () => {}, location: { origin: "http://x" } };
const sw = new Function("self", "caches", "fetch", `${src}; return { pageOfData, langOf };`)(fakeSelf, {}, () => {}) as {
  pageOfData(p: string): string | null;
  langOf(p: string): string;
};

test("maps Next data files back to the page they belong to", () => {
  expect(sw.pageOfData("/sw/savers/wallets-keys/index.txt")).toBe("/sw/savers/wallets-keys/");
  expect(sw.pageOfData("/en/builders/x/__next.$d$lang/$d$roadmap/__PAGE__.txt")).toBe("/en/builders/x/");
  expect(sw.pageOfData("/_next/static/chunks/a.js")).toBeNull();
});

test("offline fallback language follows the URL, defaulting to Kiswahili", () => {
  expect(sw.langOf("/en/savers/x/")).toBe("en");
  expect(sw.langOf("/sw/savers/x/")).toBe("sw");
  expect(sw.langOf("/")).toBe("sw");
});
