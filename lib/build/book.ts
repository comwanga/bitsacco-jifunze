import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// Each published book, with the provenance its manifest must record. Pinned, so a changed source needs a reviewed change here.
const BOOKS = [
  { manifest: "mastering-bitcoin-en-3rd-edition.source.json", filename: "mastering-bitcoin-en-3rd-edition.pdf", revision: "275c4eb8eab8800c6adc39f8def8e8f8fa356a57" },
  { manifest: "kujifunza-bitcoin-sw-3rd-edition.source.json", filename: "kujifunza-bitcoin-sw-3rd-edition.pdf", revision: "275c4eb8eab8800c6adc39f8def8e8f8fa356a57", translationRevision: "5da7e1705b29c153ef2d7ed040df8a8b6a6eed53" },
];

// The build must fail rather than ship an incomplete or silently replaced book.
export function verifyBooks(root: string) {
  const dir = path.join(root, "books");
  return BOOKS.map((book) => {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, book.manifest), "utf8"));
    if (meta.filename !== book.filename || meta.revision !== book.revision || meta.license !== "CC BY-SA 4.0" || meta.translationRevision !== book.translationRevision) throw Error(`Book provenance mismatch: ${book.filename}`);
    const data = fs.readFileSync(path.join(dir, meta.filename));
    if (data.subarray(0, 5).toString() !== "%PDF-" || data.length !== meta.bytes || createHash("sha256").update(data).digest("hex") !== meta.sha256) throw Error(`Book integrity mismatch: ${book.filename}`);
    return meta;
  });
}
