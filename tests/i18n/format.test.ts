import { expect, test } from "vitest";
import { formatBytes } from "../../lib/format.ts";

test("formatBytes shows sizes readers understand before downloading", () => {
  expect(formatBytes(184292)).toBe("180 KB");
  expect(formatBytes(908278)).toBe("887 KB");
  expect(formatBytes(7_549_747)).toBe("7.2 MB");
  expect(formatBytes(512)).toBe("1 KB");
});
