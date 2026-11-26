import { expect, test } from "vitest";
import { siteCopy } from "../../lib/site-copy.ts";

test("site copy has complete matching nonempty language keys", () => {
  expect(Object.keys(siteCopy.en).sort()).toEqual(Object.keys(siteCopy.sw).sort());
  for (const copy of Object.values(siteCopy)) expect(Object.values(copy).every((v) => typeof v === "string" && v.trim())).toBe(true);
});

test("the footer tagline repeats the four learning steps in each language", () => {
  expect(siteCopy.sw.footerTagline).toBe("Jifunze Bitcoin. Jaribu. Tumia. Shiriki.");
  expect(siteCopy.en.footerTagline).toBe("Learn Bitcoin. Practise. Use it. Share.");
});

test("the hero leads with community finance in each language", () => {
  expect(siteCopy.en.heroTitle).toBe("Check before you save");
  expect(siteCopy.sw.heroTitle).toBe("Kagua kabla ya kuweka akiba");
  expect(siteCopy.en.heroSubtitle).toBe("Chamas, SACCOs, personal savings and Bitcoin");
  expect(siteCopy.sw.heroSubtitle).toBe("Chama, SACCO, akiba binafsi na Bitcoin");
  expect(siteCopy.en.heroLead).toMatch(/^Learn how savings groups and money tools really work/);
});
