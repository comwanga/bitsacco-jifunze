import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { flatLessons, getLesson, getLibrary, listRoadmaps } from "../../lib/content/load.ts";

test("all companion-book references lead to the pending Kiswahili notice, never an unpublished download", () => {
  const pending = getLibrary().find(item => item.id === "kujifunza-bitcoin")!;
  expect(pending.format).toBe("pending-pdf");
  expect(pending.url).toBeUndefined();
  let references = 0;
  for (const roadmap of listRoadmaps()) for (const slug of flatLessons(roadmap)) for (const lang of ["en", "sw"] as const) {
    const { frontmatter } = getLesson(roadmap.id, slug, lang);
    for (const resource of frontmatter.resources) {
      expect(resource.url).not.toContain("kujifunza-bitcoin-sw.pdf");
      if (!resource.title.startsWith("Kujifunza Bitcoin")) continue;
      references++;
      expect(resource.language).toBe("sw");
      expect(resource.url).toBe("/sw/library/#kujifunza-bitcoin");
      expect(resource.note).toContain(lang === "en" ? "awaits official publication" : "inasubiri kuchapishwa rasmi");
      expect(resource.note).toContain(lang === "en" ? "not a PDF download" : "si upakuaji wa PDF");
    }
  }
  // Preserve every audited chapter reference while the translation awaits publication.
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
