import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { verifyBooks } from "../../lib/build/book.ts";

test("each packaged book matches its pinned source manifest; truncated replacements fail closed", () => {
  const books = verifyBooks(path.resolve("public"));
  expect(books.map((b) => b.filename)).toEqual(["mastering-bitcoin-en-3rd-edition.pdf", "kujifunza-bitcoin-sw-3rd-edition.pdf"]);
  for (const meta of books) {
    expect(meta.pages).toBeGreaterThan(400);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "jifunze-book-"));
    fs.cpSync(path.resolve("public/books"), path.join(root, "books"), { recursive: true });
    fs.writeFileSync(path.join(root, "books", meta.filename), "%PDF-incomplete");
    expect(() => verifyBooks(root)).toThrow(`integrity mismatch: ${meta.filename}`);
    fs.rmSync(root, { recursive: true });
  }
});

test("the Kiswahili book records its translation source, translator and licence", () => {
  const sw = verifyBooks(path.resolve("public"))[1];
  expect(sw).toMatchObject({
    language: "sw",
    translator: "comwanga",
    translationSource: "https://github.com/comwanga/bitcoinbook-swahili",
    authors: ["Andreas M. Antonopoulos", "David A. Harding"],
    license: "CC BY-SA 4.0",
  });
  expect(sw.title).toBe("Kujifunza Bitcoin: Kuprogramu Blockchain Huria (Toleo la 3)");
});
