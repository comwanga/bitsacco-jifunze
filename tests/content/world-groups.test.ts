import { expect, test } from "vitest";
import { WorldGroupsSchema } from "../../lib/content/schemas.ts";
import { getWorldGroups } from "../../lib/content/load.ts";

test("six named groups in the spec's order with both languages", () => {
  const g = getWorldGroups();
  expect(g.map((x) => x.id)).toEqual(["chama", "upatu", "susu", "arisan", "pandero", "stokvel"]);
  for (const x of g) expect(x.line.sw && x.line.en && x.place.sw && x.place.en).toBeTruthy();
});

test("coordinates outside the globe are rejected", () => {
  const g = getWorldGroups();
  expect(WorldGroupsSchema.safeParse([{ ...g[0], lat: 91 }, ...g.slice(1)]).success).toBe(false);
});

test("duplicate ids are rejected", () => {
  const g = getWorldGroups();
  expect(WorldGroupsSchema.safeParse([g[0], g[0], ...g.slice(2)]).success).toBe(false);
});
