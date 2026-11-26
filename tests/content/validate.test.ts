import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { validateContent, type Issue } from "../../lib/content/validate.ts";
import { mp4Header } from "../helpers/mp4.ts";

const BROKEN = path.join(import.meta.dirname, "../fixtures/broken");
const CLEAN = path.join(import.meta.dirname, "../fixtures/content");
const temporaryRoots: string[] = [];
afterEach(() => { for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function withRoadmap(edit: (roadmap: { sections: { id: string; lessons: { slug: string; prerequisites?: string[] }[] }[] }) => void): Issue[] {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jifunze-validation-"));
  temporaryRoots.push(root);
  fs.cpSync(CLEAN, root, { recursive: true });
  const file = path.join(root, "roadmaps/savers.json");
  const roadmap = JSON.parse(fs.readFileSync(file, "utf8"));
  edit(roadmap);
  fs.writeFileSync(file, JSON.stringify(roadmap));
  return validateContent(root, { checksDir: path.join(CLEAN, "../lab/jifunze_lab/checks") }).filter((i) => i.level === "error");
}

const issues = validateContent(BROKEN);
function find(rule: Issue["rule"], level: Issue["level"], fileFragment: string, msg?: RegExp) {
  return issues.filter(
    (i) =>
      i.rule === rule &&
      i.level === level &&
      i.file.replaceAll("\\", "/").includes(fileFragment) &&
      (!msg || msg.test(i.message)),
  );
}

describe("rule 1: both languages or translationPending", () => {
  test("a lesson only in en without translationPending is an error", () => {
    expect(find(1, "error", "only-en")).toHaveLength(1);
  });
});

describe("rule 2: schema and roadmap integrity", () => {
  test("missing objectives is an error", () => {
    expect(find(2, "error", "en/no-objectives.mdx", /objectives/)).toHaveLength(1);
  });
  test("a roadmap entry with no lesson file is an error", () => {
    expect(find(2, "error", "roadmaps/savers.json", /missing-file/)).toHaveLength(1);
  });
  test("an unknown prerequisite is an error", () => {
    expect(find(2, "error", "roadmaps/savers.json", /ghost/)).toHaveLength(1);
  });
  test("a lesson without a lastReviewed date is not flagged as a draft", () => {
    expect(find(2, "warning", "sw/no-review.mdx", /lastReviewed/)).toHaveLength(0);
  });
  test("rejects self-dependency and prerequisite cycles, but permits a shared prerequisite", () => {
    expect(withRoadmap((r) => { r.sections[0].lessons[0].prerequisites = ["alpha"]; })).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 2, message: expect.stringMatching(/prerequisite cycle.*alpha.*alpha/) })]),
    );
    expect(withRoadmap((r) => {
      r.sections[0].lessons[0].prerequisites = ["gamma"];
      r.sections.flatMap((s) => s.lessons).find((l) => l.slug === "gamma")!.prerequisites = ["alpha"];
    })).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 2, message: expect.stringMatching(/prerequisite cycle/) })]));
    expect(withRoadmap((r) => {
      for (const l of r.sections.flatMap((s) => s.lessons)) if (l.slug !== "alpha") l.prerequisites = ["alpha"];
    })).toEqual([]);
  });
  test("rejects repeated section IDs that would generate duplicate navigation anchors", () => {
    expect(withRoadmap((r) => { r.sections[1].id = r.sections[0].id; })).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 2, message: expect.stringMatching(/duplicate section id/) })]),
    );
  });
});

describe("rule 3: quizzes and resource links", () => {
  test("a quiz answer that is not an option is an error", () => {
    expect(find(3, "error", "quizzes/savers/only-en.json", /"z"/)).toHaveLength(1);
  });
  test("a quiz for a lesson not in any roadmap is an error", () => {
    expect(find(3, "error", "quizzes/savers/orphan.json")).toHaveLength(1);
  });
  test("malformed and non-https resource URLs are errors", () => {
    expect(find(3, "error", "sw/bad-url.mdx", /not a url/)).toHaveLength(1);
    expect(find(3, "error", "en/bad-url.mdx", /https/)).toHaveLength(1);
  });
});

describe("rule 4: adapted lessons name their source and licence", () => {
  test("adapted without licence is a rule 4 error, not a duplicate rule 2 error", () => {
    expect(find(4, "error", "sw/adapted-no-licence.mdx", /licence/)).toHaveLength(1);
    expect(find(2, "error", "sw/adapted-no-licence.mdx")).toHaveLength(0);
  });
});

describe("rule 5: glossary consistency (warnings)", () => {
  test("unknown term ids are warnings", () => {
    expect(find(5, "warning", "sw/bad-terms.mdx", /unknown-id/)).toHaveLength(1);
    expect(find(5, "warning", "sw/bad-terms.mdx", /nope/)).toHaveLength(1);
  });
  test("English term used in a Kiswahili lesson is a warning, once, ignoring code blocks", () => {
    expect(find(5, "warning", "sw/bad-terms.mdx", /maneno ya siri/)).toHaveLength(1);
  });
  test("tag names and attributes are not prose: <Term id=...>children</Term> and Callout type don't warn", () => {
    expect(find(5, "warning", "sw/bad-terms.mdx", /"phishing"|"seed phrase".*maneno/)).toHaveLength(1);
    expect(issues.filter((i) => i.rule === 5 && i.file.includes("tag-attrs"))).toEqual([]);
  });
  test("rule 5 never produces errors", () => {
    expect(issues.filter((i) => i.rule === 5 && i.level === "error")).toHaveLength(0);
  });
});

describe("clean content", () => {
  test("has no errors", () => {
    expect(validateContent(CLEAN).filter((i) => i.level === "error")).toEqual([]);
  });
});

describe("rule 7: blog posts", () => {
  type Edit = { posts?: (p: Record<string, unknown>[]) => void; files?: Record<string, string | null>; publicFiles?: Record<string, Buffer | string> };
  /** A copy of the clean tree (content/ next to public/, as in the repo) with one thing changed. */
  function blogErrors(edit: Edit): Issue[] {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "jifunze-blog-"));
    temporaryRoots.push(base);
    const root = path.join(base, "content");
    fs.cpSync(CLEAN, root, { recursive: true });
    const postsFile = path.join(root, "blog/posts.json");
    const posts = JSON.parse(fs.readFileSync(postsFile, "utf8"));
    edit.posts?.(posts);
    fs.writeFileSync(postsFile, JSON.stringify(posts));
    for (const [rel, text] of Object.entries(edit.files ?? {})) {
      const file = path.join(root, "blog", rel);
      if (text === null) fs.rmSync(file);
      else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
    }
    for (const [rel, data] of Object.entries(edit.publicFiles ?? {})) {
      const file = path.join(base, "public", rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, data);
    }
    return validateContent(root, { checksDir: path.join(CLEAN, "../lab/jifunze_lab/checks") }).filter((i) => i.rule === 7 && i.level === "error");
  }
  const post = (body: string, extra = "") => `---\ntitle: "T"\ndescription: "D"\n${extra}---\n\n${body}\n`;
  const one = (edit: Edit, msg: RegExp) => {
    const errors = blogErrors(edit);
    expect(errors.map((e) => e.message)).toEqual([expect.stringMatching(msg)]);
  };

  test("the clean fixture blog has no blog errors", () => {
    expect(blogErrors({})).toEqual([]);
  });
  test("a registry entry with no language file", () => {
    one({ posts: (p) => p.push({ slug: "ghost", category: "guides", author: "A", publishedAt: "2026-11-01", relatedLessons: ["savers/alpha"] }) }, /no Kiswahili or English file/);
  });
  test("a post file that is not in the registry", () => {
    one({ files: { "en/stray.mdx": post("Text") } }, /not listed in posts\.json/);
  });
  test("a duplicate slug", () => {
    one({ posts: (p) => p.push({ ...p[0] }) }, /duplicate slug/);
  });
  test("an unknown category", () => {
    one({ posts: (p) => { p[0].category = "gossip"; } }, /unknown category/);
  });
  test("updatedAt before publishedAt", () => {
    one({ posts: (p) => { p[0].updatedAt = "2026-10-01"; } }, /updatedAt is before publishedAt/);
  });
  test("a related lesson that does not exist", () => {
    one({ posts: (p) => { p[0].relatedLessons = ["savers/nope"]; } }, /related lesson "savers\/nope" does not exist/);
  });
  test("an image file that is missing", () => {
    one({ posts: (p) => { p[0].image = "/images/blog/missing.png"; }, files: { "en/english-only.mdx": post("Text", 'imageAlt: "A"\n') } }, /image file not found/);
  });
  test("an image without alt text in a language file", () => {
    one({ posts: (p) => { p[0].image = "/images/blog/ok.png"; }, publicFiles: { "images/blog/ok.png": "png" } }, /imageAlt is required/);
  });
  test("an image over 400 KB", () => {
    one({
      posts: (p) => { p[0].image = "/images/blog/big.png"; },
      files: { "en/english-only.mdx": post("Text", 'imageAlt: "A"\n') },
      publicFiles: { "images/blog/big.png": Buffer.alloc(400 * 1024 + 1) },
    }, /larger than 400 KB/);
  });
  test("a lab exercise in a post", () => {
    one({ files: { "en/english-only.mdx": post('<Exercise id="x" />') } }, /labs are not allowed in posts/);
  });
  test("a diagram without alt text", () => {
    one({
      files: { "en/english-only.mdx": post('<Diagram src="/images/blog/ok.png">\n<Marker x={10} y={20} title="One">Text</Marker>\n</Diagram>') },
      publicFiles: { "images/blog/ok.png": "png" },
    }, /diagram needs alt text/);
  });
  test("a marker outside the image", () => {
    one({
      files: { "en/english-only.mdx": post('<Diagram src="/images/blog/ok.png" alt="A">\n<Marker x={120} y={20} title="One">Text</Marker>\n</Diagram>') },
      publicFiles: { "images/blog/ok.png": "png" },
    }, /marker position must be 0–100/);
  });
  const clip = (attrs: string) => ({ files: { "en/english-only.mdx": post(`<Video ${attrs} />`) } });
  const okMedia = {
    "images/blog/poster.webp": "img",
    "videos/blog/clip.mp4": mp4Header(30),
    "videos/blog/clip.en.vtt": "WEBVTT\n\n00:00.000 --> 00:01.000\nHi\n",
  };
  const goodVideo = 'src="/videos/blog/clip.mp4" poster="/images/blog/poster.webp" captions="/videos/blog/clip.en.vtt" title="Clip"';
  test("a correct video passes", () => {
    expect(blogErrors({ ...clip(goodVideo), publicFiles: okMedia })).toEqual([]);
  });
  test("a video file that is missing", () => {
    one({ ...clip(goodVideo.replace("clip.mp4", "gone.mp4")), publicFiles: okMedia }, /video file not found/);
  });
  test("a video that is not an MP4", () => {
    one({ ...clip(goodVideo), publicFiles: { ...okMedia, "videos/blog/clip.mp4": "not a video" } }, /video must be an MP4/);
  });
  test("a video over 10 MB", () => {
    const big = Buffer.concat([mp4Header(30), Buffer.alloc(10 * 1024 * 1024)]);
    one({ ...clip(goodVideo), publicFiles: { ...okMedia, "videos/blog/clip.mp4": big } }, /larger than 10 MB/);
  });
  test("a video over 2 minutes", () => {
    one({ ...clip(goodVideo), publicFiles: { ...okMedia, "videos/blog/clip.mp4": mp4Header(180) } }, /longer than 2 minutes/);
  });
  test("a video without a poster", () => {
    one({ ...clip(goodVideo.replace(' poster="/images/blog/poster.webp"', "")), publicFiles: okMedia }, /video needs a poster image/);
  });
  test("captions that are not WebVTT", () => {
    one({ ...clip(goodVideo), publicFiles: { ...okMedia, "videos/blog/clip.en.vtt": "1\n00:00:00,000 --> 00:00:01,000\nHi\n" } }, /captions must be a WebVTT file/);
  });
  test("a video link that is not https", () => {
    one({
      files: { "en/english-only.mdx": post('<VideoLink href="http://example.com/v" poster="/images/blog/poster.webp" title="T" duration="1:00" />') },
      publicFiles: okMedia,
    }, /https/);
  });
  const svgPost = (svg: string) => ({
    files: { "en/english-only.mdx": post('<Diagram src="/images/blog/d.svg" alt="A">\n<Marker x={10} y={20} title="One">Text</Marker>\n</Diagram>') },
    publicFiles: { "images/blog/d.svg": svg },
  });
  test("a plain SVG diagram passes", () => {
    expect(blogErrors(svgPost('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><title>t</title><rect width="10" height="10"/></svg>'))).toEqual([]);
  });
  for (const [name, svg] of [
    ["a script element", '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>fetch("/api/")</script></svg>'],
    ["an event handler", '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="alert(1)"><rect/></svg>'],
    ["embedded HTML", '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><foreignObject><div>x</div></foreignObject></svg>'],
    ["a javascript: link", '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><a href="javascript:alert(1)"><rect/></a></svg>'],
    ["an outside resource", '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image href="https://example.com/x.png"/></svg>'],
  ] as const) {
    test(`an SVG with ${name} is rejected`, () => {
      one(svgPost(svg), /SVG .*can run code or load outside content/);
    });
  }
  test("an SVG without width and height (it would display at a 300×150 default size)", () => {
    one(svgPost('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'), /SVG .*needs width and height/);
  });
  test("the launch diagrams pass the SVG safety check", () => {
    for (const lang of ["en", "sw"]) {
      const svg = fs.readFileSync(path.join(CLEAN, `../../../public/images/blog/chama-treasury-${lang}.svg`), "utf8");
      expect(blogErrors(svgPost(svg))).toEqual([]);
    }
  });
  for (const date of ["2026-11-31", "2026-13-01", "2026-02-29"]) {
    test(`an impossible publishedAt date (${date})`, () => {
      one({ posts: (p) => { p[0].publishedAt = date; } }, /publishedAt "\d{4}-\d{2}-\d{2}" is not a real calendar date/);
    });
  }
  test("a link in the post text that is not https", () => {
    one({ files: { "en/english-only.mdx": post("Read [this](http://example.com/page) first.") } }, /must use https/);
  });
  test("a self-closing diagram without markers", () => {
    one({ files: { "en/english-only.mdx": post('<Diagram src="/images/blog/ok.png" alt="A" />') }, publicFiles: { "images/blog/ok.png": "png" } }, /diagram needs at least one <Marker>/);
  });
  test("an empty registry, because the static build needs at least one post page", () => {
    one({ posts: (p) => p.splice(0), files: { "en/both.mdx": null, "sw/both.mdx": null, "en/english-only.mdx": null, "sw/swahili-featured.mdx": null } }, /at least one post/);
  });
  test("the writer template folder is ignored", () => {
    expect(blogErrors({ files: { "_template/post.mdx": post('<Exercise id="x" />') } })).toEqual([]);
  });
});
