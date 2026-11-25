import fs from "node:fs";
import { expect, test } from "vitest";

// Browsers without :has() cannot pause the circle, so they must not animate it or show the pause switch.
test("the circle only animates, and only shows its pause switch, where :has() is supported", () => {
  const css = fs.readFileSync("components/home/savings-circle.css", "utf8");
  const start = css.indexOf("@supports selector(:has(*))");
  expect(start).toBeGreaterThan(-1);
  let depth = 0;
  let end = css.indexOf("{", start);
  for (let i = end; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  const outside = css.slice(0, start) + css.slice(end);
  const animations = [...outside.matchAll(/animation\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
  expect(animations.every((v) => v === "none"), animations.join(" | ")).toBe(true);
  expect(outside).toMatch(/\.circle-pause-control\s*\{\s*display:\s*none;/);
});
