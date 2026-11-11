import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { validateContent, type Issue } from "../../lib/content/validate.ts";

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
  test("missing lastReviewed is a warning", () => {
    expect(find(2, "warning", "sw/no-review.mdx", /lastReviewed/)).toHaveLength(1);
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
