import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ContinueLearning } from "../../components/home/ContinueLearning";
import { emptyProgress, type Progress } from "../../lib/progress/model";
import { useProgress } from "../../lib/progress/useProgress";

vi.mock("../../lib/progress/useProgress", () => ({ useProgress: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const key = "builders/first";
const at = "2026-11-01T10:00:00Z";
function render(progress: Progress, lang: "en" | "sw" = "en", minutes: Record<string, number> = { [key]: 12 }) {
  vi.mocked(useProgress).mockReturnValue({ progress } as ReturnType<typeof useProgress>);
  return renderToStaticMarkup(<ContinueLearning lang={lang} paths={[{ id: "builders", slugs: ["first"] }]}
    titles={{ [key]: "First lesson" }} pathTitles={{ builders: "Builders" }} minutes={minutes} />);
}

describe("ContinueLearning estimates", () => {
  test("uses the full lesson duration regardless of quiz score or reflection", () => {
    for (const correct of [0, 1, 4]) {
      const html = render({ ...emptyProgress(), lessons: { [key]: { reflectedAt: at, quiz: { correct, total: 4, at } } } });
      expect(html).toContain("Full lesson estimate: 12 minutes.");
      expect(html).toContain("You&#x27;re making progress! Keep going.");
      expect(html).toContain("First lesson");
      expect(html).toContain("Builders");
      expect(html).toContain('href="/en/builders/first"');
      expect(html).not.toMatch(/remaining|%/);
    }
  });
  test("offers natural Kiswahili copy", () => {
    const html = render({ ...emptyProgress(), lessons: { [key]: { reflectedAt: at } } }, "sw");
    expect(html).toContain("Unaendelea vizuri! Endelea kujifunza.");
    expect(html).toContain("Makadirio ya somo zima: dakika 12.");
    expect(html).toContain("Endelea kujifunza</a>");
  });
  test("omits estimates for missing or invalid duration metadata", () => {
    const estimates: Record<string, number>[] = [{}, { [key]: 0 }, { [key]: NaN }, { [key]: -5 }];
    for (const minutes of estimates) {
      const html = render({ ...emptyProgress(), lessons: { [key]: { reflectedAt: at } } }, "en", minutes);
      expect(html).toContain("Keep going.");
      expect(html).not.toContain("Full lesson estimate");
    }
  });
  test("has no card for missing, empty, lab-only, retired or completed activity", () => {
    const activity: Progress["lessons"][] = [{}, { [key]: {} }, { [key]: { lab: { passed: ["one"] } } },
      { "builders/retired": { reflectedAt: at } }, { [key]: { completedAt: at } }];
    for (const lessons of activity) {
      expect(render({ ...emptyProgress(), lessons })).toBe("");
    }
  });
});
