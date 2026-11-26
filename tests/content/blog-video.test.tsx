import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { renderBlogBody } from "../../lib/content/mdx.ts";

test("a self-hosted video downloads nothing until play and carries captions in the post language", async () => {
  const html = renderToStaticMarkup(
    await renderBlogBody(
      '<Video src="/videos/blog/clip.mp4" poster="/images/blog/clip.webp" captions="/videos/blog/clip.sw.vtt" title="Saini mbili" />',
      "sw",
      [],
    ),
  );
  expect(html).toMatch(/<figure[^>]*data-video/);
  const video = /<video[^>]*>/.exec(html)?.[0] ?? "";
  expect(video).toContain('preload="none"');
  expect(video).toContain("playsInline");
  expect(video).toContain("controls");
  expect(video).toContain('poster="/images/blog/clip.webp"');
  expect(video).not.toMatch(/autoplay|loop/i);
  expect(html).toContain('src="/videos/blog/clip.mp4"');
  expect(html).toMatch(/<track[^>]*kind="captions"/);
  expect(html).toMatch(/<track[^>]*srcLang="sw"/);
  expect(html).toMatch(/<track[^>]*src="\/videos\/blog\/clip\.sw\.vtt"/);
  expect(html).toMatch(/<figcaption[^>]*>Saini mbili<\/figcaption>/);
  expect(html).toMatch(/data-video-offline[^>]*hidden|hidden[^>]*data-video-offline/);
  expect(html).toContain("Video hii inahitaji mtandao.");
});

test("a video link is a plain link card that names where it opens", async () => {
  const html = renderToStaticMarkup(
    await renderBlogBody(
      '<VideoLink href="https://www.youtube.com/watch?v=x" poster="/images/blog/talk.webp" title="A long talk" duration="12:30" />',
      "en",
      [],
    ),
  );
  expect(html).toMatch(/<a[^>]*data-video-link[^>]*>/);
  expect(html).toContain('href="https://www.youtube.com/watch?v=x"');
  expect(html).toContain('src="/images/blog/talk.webp"');
  expect(html).toContain("A long talk");
  expect(html).toContain("12:30");
  expect(html).toMatch(/data-video-host[^>]*>Opens on youtube\.com</);
  expect(html).not.toContain("<iframe");
});
