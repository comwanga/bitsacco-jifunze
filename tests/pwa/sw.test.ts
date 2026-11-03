import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const src = fs.readFileSync(path.join(import.meta.dirname, "../../public/sw.js"), "utf8");
const fakeSelf = { addEventListener: () => {}, location: { origin: "http://x" } };
const sw = new Function("self", "caches", "fetch", `${src}; return { pageOfData, langOf, staleCaches };`)(fakeSelf, {}, () => {}) as {
  pageOfData(p: string): string | null;
  langOf(p: string): string;
  staleCaches(keys: string[]): string[];
};

test("a new deploy keeps the pages readers saved offline; only unknown caches are removed", () => {
  const keep = ["pages-v1", "static-v1", "data-v1"];
  expect(sw.staleCaches([...keep, "pages-OLDBUILD", "static-OLDBUILD", "other"])).toEqual(["pages-OLDBUILD", "static-OLDBUILD", "other"]);
  expect(src).not.toMatch(/const PAGES = `pages-\$\{VERSION\}`/);
});

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
