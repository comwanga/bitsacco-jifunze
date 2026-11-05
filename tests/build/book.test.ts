import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { verifyBook } from "../../lib/build/book.ts";

test("the packaged book matches the pinned source manifest; truncated replacements fail closed", () => {
  const meta = verifyBook(path.resolve("public"));
  expect(meta.pages).toBeGreaterThan(400);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jifunze-book-"));
  fs.cpSync(path.resolve("public/books"), path.join(root, "books"), { recursive: true });
  fs.writeFileSync(path.join(root, "books", meta.filename), "%PDF-incomplete");
  expect(() => verifyBook(root)).toThrow("integrity mismatch");
  fs.rmSync(root, { recursive: true });
});
