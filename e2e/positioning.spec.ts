import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("the old Savers path name is gone from the built site", () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".html") && /Bitcoin for Savers|Bitcoin kwa Wawekaji/.test(fs.readFileSync(p, "utf8"))) hits.push(p);
    }
  };
  walk(path.join(process.cwd(), "out"));
  expect(hits).toEqual([]);
});
