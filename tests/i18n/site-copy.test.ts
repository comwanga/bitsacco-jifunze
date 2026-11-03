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
