import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { flatLessons, getLesson, getLibrary, listRoadmaps } from "../../lib/content/load.ts";

test("all companion-book references open the Kiswahili book page, which serves the verified local PDF", () => {
  const book = getLibrary().find(item => item.id === "kujifunza-bitcoin")!;
  const meta = JSON.parse(fs.readFileSync("public/books/kujifunza-bitcoin-sw-3rd-edition.source.json", "utf8"));
  expect(book.format).toBe("pdf");
  expect(book.url).toBe(`/books/${meta.filename}`);
  expect(book.sizeBytes).toBe(meta.bytes);
  let references = 0;
  for (const roadmap of listRoadmaps()) for (const slug of flatLessons(roadmap)) for (const lang of ["en", "sw"] as const) {
    const { frontmatter } = getLesson(roadmap.id, slug, lang);
    for (const resource of frontmatter.resources) {
      expect(resource.url).not.toContain("kujifunza-bitcoin-sw.pdf"); // Bitsacco's unpublished copy
      if (!resource.title.startsWith("Kujifunza Bitcoin")) continue;
      references++;
      expect(resource.language).toBe("sw");
      expect(resource.url).toBe("/sw/library/kujifunza-bitcoin/");
      expect(resource.note).toContain(lang === "en" ? "read or download it" : "kukisoma au kukipakua");
      expect(resource.note).not.toMatch(/awaits official publication|inasubiri kuchapishwa rasmi/);
    }
  }
  // Every audited chapter reference is kept.
  expect(references).toBe(30);
});

test("new-contributor commands use the public repository, matching directories and available checks", () => {
  const scripts = JSON.parse(fs.readFileSync("package.json", "utf8")).scripts;
  for (const file of ["CONTRIBUTING.md", "content/builders/en/contributing-oss.mdx", "content/builders/sw/contributing-oss.mdx"]) {
    const text = fs.readFileSync(file, "utf8");
    expect(text).not.toContain("bitsacco/jifunze");
    expect(text).toContain("gh repo fork comwanga/bitsacco-jifunze --clone");
    expect(text).toMatch(/^cd bitsacco-jifunze$/m);
    expect(text).toContain("npm ci --prefix api");
    for (const match of text.matchAll(/npm run ([\w:-]+)/g)) expect(scripts[match[1]]).toBeTruthy();
  }
  for (const lang of ["en", "sw"]) {
    const text = fs.readFileSync(path.join("content/lightning", lang, "getting-started.mdx"), "utf8");
    expect(text).not.toContain("bitsacco/jifunze");
    expect(text).toContain("git clone https://github.com/comwanga/bitsacco-jifunze");
    expect(text).toMatch(/^cd bitsacco-jifunze\/lab$/m);
    expect(fs.existsSync("lab/lab")).toBe(true);
  }
});

test("lost-phone recovery distinguishes client recovery material from federation backing in both languages", () => {
  const en = getLesson("savers", "custody-and-fedimint", "en").body;
  const sw = getLesson("savers", "custody-and-fedimint", "sw").body;
  const cell = (body: string, label: string) => body.split("\n").find(line => line.startsWith(`| ${label} |`))!.split("|")[4];
  const english = cell(en, "If you lose your phone");
  const kiswahili = cell(sw, "Ukipoteza simu");
  expect(en).not.toContain("The federation still holds your ecash");
  expect(sw).not.toContain("Shirikisho bado linashika ecash yako");
  expect(english).toContain("safely backed-up wallet recovery key or seed");
  expect(english).toContain("supported recovery process");
  expect(english).toContain("bitcoin alone is insufficient");
  expect(english).toContain("not guaranteed");
  for (const phrase of ["nakala salama", "ufunguo au maneno ya siri", "njia ya urejeshaji", "bitcoin ya shirikisho pekee haitoshi", "haujahakikishwa"]) {
    expect(kiswahili.toLowerCase()).toContain(phrase);
  }
});
