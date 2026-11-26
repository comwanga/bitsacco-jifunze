import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { renderBlogBody } from "../../lib/content/mdx.ts";

const body = `Kabla.

<Diagram src="/images/blog/chama-treasury-sw.svg" alt="Hazina ya chama">
  <Marker x={22} y={30} title="Nani anashika funguo">Wanachama wanajua nani anashika kila ufunguo.</Marker>
  <Marker x={70} y={55} title="Mweka hazina akiondoka">Saini mbili bado zinatosha.</Marker>
</Diagram>

Baadaye.`;

test("a diagram renders its image, numbered markers and every explanation without JavaScript", async () => {
  const html = renderToStaticMarkup(await renderBlogBody(body, "sw", []));
  expect(html).toMatch(/<figure[^>]*data-diagram/);
  expect(html).toContain('src="/images/blog/chama-treasury-sw.svg"');
  expect(html).toContain('alt="Hazina ya chama"');
  expect(html).toMatch(/data-marker="1"[^>]*style="left:22%;top:30%"|style="left:22%;top:30%"[^>]*data-marker="1"/);
  expect(html).toMatch(/data-marker="2"[^>]*style="left:70%;top:55%"|style="left:70%;top:55%"[^>]*data-marker="2"/);
  const notes = /<ol[^>]*data-diagram-notes[^>]*>([\s\S]*?)<\/ol>/.exec(html)?.[1] ?? "";
  expect(notes.indexOf("Nani anashika funguo")).toBeGreaterThanOrEqual(0);
  expect(notes.indexOf("Nani anashika funguo")).toBeLessThan(notes.indexOf("Mweka hazina akiondoka"));
  expect(notes).toContain("Saini mbili bado zinatosha.");
  expect(html).not.toMatch(/<button/); // markers become buttons only after the island hydrates
});

test("a lab exercise renders nothing in a post", async () => {
  const html = renderToStaticMarkup(await renderBlogBody('Text.\n\n<Exercise id="x" />', "en", []));
  expect(html).toContain("Text.");
  expect(html).not.toContain("data-jifunze-lab");
});
