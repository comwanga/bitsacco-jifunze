import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { extractHeadings, slugify } from "../../lib/content/headings.ts";
import { renderLessonBody } from "../../lib/content/mdx.ts";

describe("slugify", () => {
  test("keeps Kiswahili words and digits, drops punctuation", () => {
    expect(slugify("Hatua ya 1: Mfumo wa UTXO")).toBe("hatua-ya-1-mfumo-wa-utxo");
  });
  test("strips accents and trims dashes", () => {
    expect(slugify("  —Café, ñandú!—  ")).toBe("cafe-nandu");
  });
  test("a heading with no letters still gets an id", () => {
    expect(slugify("!!!")).toBe("sehemu");
  });
});

describe("extractHeadings", () => {
  test("takes ## and ### only, with their depth", () => {
    expect(extractHeadings("# Kichwa\n\n## Moja\n\n### Ndani\n\n#### Chini\n")).toEqual([
      { depth: 2, text: "Moja", id: "moja" },
      { depth: 3, text: "Ndani", id: "ndani" },
    ]);
  });
  test("repeated headings get unique ids", () => {
    expect(extractHeadings("## Jaribu\n\ntext\n\n## Jaribu\n\n## Jaribu\n").map((h) => h.id)).toEqual(["jaribu", "jaribu-2", "jaribu-3"]);
  });
  test("ignores lines inside code fences", () => {
    expect(extractHeadings("```md\n## Si kichwa\n```\n\n## Kichwa halisi\n").map((h) => h.text)).toEqual(["Kichwa halisi"]);
  });
  test("inline code and links keep their text", () => {
    expect(extractHeadings("## Run `lncli getinfo` on [Alice](https://x.test)\n")).toEqual([
      {
        depth: 2,
        text: "Run lncli getinfo on Alice",
        id: "run-lncli-getinfo-on-alice",
      },
    ]);
  });
});

describe("rendered lessons carry the heading ids", () => {
  test("every id from extractHeadings is on the page, in order", async () => {
    const body =
      "## Kazi tatu za pesa\n\nMaandishi.\n\n### Hatua ya 1: Mfumo wa UTXO\n\n```sh\n## not a heading\n```\n\n## Jaribu\n\n## Jaribu\n";
    const html = renderToStaticMarkup(await renderLessonBody(body, "sw", []));
    const ids = [...html.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(extractHeadings(body).map((h) => h.id));
    expect(ids).toEqual(["kazi-tatu-za-pesa", "hatua-ya-1-mfumo-wa-utxo", "jaribu", "jaribu-2"]);
  });
});
