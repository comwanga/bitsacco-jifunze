import { expect, test } from "vitest";
import { LibraryItemSchema } from "../../lib/content/schemas";

const book = { id: "book", title: { en: "Book", sw: "Kitabu" }, author: "Author", language: "en", licence: "CC BY-SA 4.0" };

test("pending resources cannot advertise a download and available resources need a URL", () => {
  expect(LibraryItemSchema.safeParse({ ...book, format: "pending-pdf" }).success).toBe(true);
  expect(LibraryItemSchema.safeParse({ ...book, format: "pending-pdf", url: "https://example.test/missing.pdf" }).success).toBe(false);
  expect(LibraryItemSchema.safeParse({ ...book, format: "online" }).success).toBe(false);
});

test("existing PDF entries retain required file-size validation; online editions are not labelled as PDFs", () => {
  const url = "https://example.test/book";
  expect(LibraryItemSchema.safeParse({ ...book, url }).success).toBe(false);
  expect(LibraryItemSchema.parse({ ...book, url, sizeBytes: 123 }).format).toBe("pdf");
  expect(LibraryItemSchema.parse({ ...book, format: "online", url }).sizeBytes).toBeUndefined();
});
