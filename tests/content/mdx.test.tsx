import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { renderLessonBody } from "../../lib/content/mdx.ts";
import type { GlossaryTerm } from "../../lib/content/schemas.ts";

const glossary: GlossaryTerm[] = [
  { id: "seed-phrase", sw: "maneno ya siri", en: "seed phrase", definition: { sw: "Maneno 12 au 24.", en: "12 or 24 words." } },
];

describe("renderLessonBody", () => {
  test("<Term> renders the term in the page language and links to the glossary", async () => {
    const html = renderToStaticMarkup(await renderLessonBody('Andika <Term id="seed-phrase" />.', "sw", glossary));
    expect(html).toContain("maneno ya siri");
    expect(html).toContain('href="/sw/glossary/#seed-phrase"');
    expect(html).toContain('title="Maneno 12 au 24."');
  });
  test("an unknown <Term> id renders its id instead of crashing", async () => {
    const html = renderToStaticMarkup(await renderLessonBody('<Term id="ghost" />', "en", glossary));
    expect(html).toContain("ghost");
  });
  test("GFM tables render", async () => {
    const html = renderToStaticMarkup(await renderLessonBody("| a | b |\n| - | - |\n| 1 | 2 |", "en", glossary));
    expect(html).toContain("<table>");
  });
  test("<Callout> renders a titled aside", async () => {
    const html = renderToStaticMarkup(
      await renderLessonBody('<Callout type="scam" title="Tahadhari">Usishiriki maneno yako.</Callout>', "sw", glossary),
    );
    expect(html).toMatch(/<aside[^>]*data-type="scam"/);
    expect(html).toContain("Tahadhari");
  });
});
