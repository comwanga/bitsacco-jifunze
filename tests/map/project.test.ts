import { expect, test } from "vitest";
import { MAP, MAP_HEIGHT, project } from "../../lib/map/project.ts";

test("corners and the equator project as the spec defines", () => {
  expect(project(MAP.latTop, -180)).toEqual({ x: 0, y: 0 });
  expect(project(MAP.latBottom, 180)).toEqual({ x: 1000, y: MAP_HEIGHT });
  expect(project(0, 0).x).toBe(500);
  expect(project(0, 0).y).toBeCloseTo((84 / 142) * MAP_HEIGHT, 6);
});
