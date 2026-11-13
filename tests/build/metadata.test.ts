import { expect, test } from "vitest";
import sitemap from "../../app/sitemap";
import robots from "../../app/robots";
import { SITE_URL } from "../../lib/site";
import { listRoadmaps, flatLessons } from "../../lib/content/load";
import { SIMULATIONS } from "../../lib/simulations/registry";
import { LANGS } from "../../lib/i18n";

test("sitemap includes every localised page with matching language alternatives", () => {
  const entries = sitemap();
  const roadmaps = listRoadmaps();
  const expectedCount = (6 + roadmaps.length * 2 + roadmaps.reduce((n, r) => n + flatLessons(r).length, 0) + 1 + SIMULATIONS.length) * LANGS.length;
  expect(entries).toHaveLength(expectedCount);
  expect(new Set(entries.map((e) => e.url)).size).toBe(entries.length);
  expect(entries.filter((e) => e.url.includes("/offline/"))).toEqual([]); // offline pages are noindex
  for (const suffix of ["sw/savers/wallets-keys/", "en/lightning/conclusion/", "sw/learn/", "en/glossary/", "en/list/builders/", "sw/list/lightning/", "en/simulations/utxo/", "sw/simulations/channel-balances/"]) {
    expect(entries.some((e) => e.url === `${SITE_URL}/${suffix}`)).toBe(true);
  }
  expect(entries.filter((e) => e.url.includes("/tree/"))).toEqual([]); // canonical is the standard path URL
  const lesson = entries.find((e) => e.url === `${SITE_URL}/sw/savers/wallets-keys/`)!;
  expect(lesson.alternates?.languages).toEqual({
    sw: `${SITE_URL}/sw/savers/wallets-keys/`, en: `${SITE_URL}/en/savers/wallets-keys/`,
  });
  expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_URL}/sitemap.xml` });
});
