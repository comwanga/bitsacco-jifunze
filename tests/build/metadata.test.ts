import { expect, test } from "vitest";
import sitemap from "../../app/sitemap";
import robots from "../../app/robots";
import { SITE_URL } from "../../lib/site";

test("sitemap includes every localised page with matching language alternatives", () => {
  const entries = sitemap();
  expect(entries).toHaveLength(84);
  expect(new Set(entries.map((e) => e.url)).size).toBe(entries.length);
  for (const suffix of ["sw/savers/wallets-keys/", "en/lightning/conclusion/", "sw/learn/", "en/glossary/"]) {
    expect(entries.some((e) => e.url === `${SITE_URL}/${suffix}`)).toBe(true);
  }
  const lesson = entries.find((e) => e.url === `${SITE_URL}/sw/savers/wallets-keys/`)!;
  expect(lesson.alternates?.languages).toEqual({
    sw: `${SITE_URL}/sw/savers/wallets-keys/`, en: `${SITE_URL}/en/savers/wallets-keys/`,
  });
  expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_URL}/sitemap.xml` });
});
