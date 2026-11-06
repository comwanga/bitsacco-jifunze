import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// The build must fail rather than ship an incomplete or silently replaced book.
export function verifyBook(root: string) {
  const dir = path.join(root, "books");
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "mastering-bitcoin-en-3rd-edition.source.json"), "utf8"));
  if (meta.filename !== "mastering-bitcoin-en-3rd-edition.pdf" || meta.revision !== "275c4eb8eab8800c6adc39f8def8e8f8fa356a57" || meta.license !== "CC BY-SA 4.0") throw Error("Book provenance mismatch");
  const data = fs.readFileSync(path.join(dir, meta.filename));
  if (data.subarray(0, 5).toString() !== "%PDF-" || data.length !== meta.bytes || createHash("sha256").update(data).digest("hex") !== meta.sha256) throw Error("Book integrity mismatch");
  return meta;
}
