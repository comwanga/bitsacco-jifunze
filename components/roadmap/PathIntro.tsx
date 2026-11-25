import type { PathIntroCopy } from "@/lib/content/path-intro";
import type { Lang } from "@/lib/i18n";
import { siteCopy } from "@/lib/site-copy";

/** What a path teaches, how its lessons work and who it is for, below the path header. */
export function PathIntro({ intro, lang }: { intro: PathIntroCopy; lang: Lang }) {
  const c = siteCopy[lang];
  return (
    <section data-path-intro aria-label={c.pathOutcomesTitle} className="mx-auto max-w-3xl px-4 pt-8">
      <h2 className="text-xl font-bold">{c.pathOutcomesTitle}</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        {intro.outcomes.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-bold">{c.pathFormatTitle}</h2>
          <p className="mt-2 text-[var(--muted)]">{intro.format}</p>
        </div>
        <div>
          <h2 className="text-xl font-bold">{c.pathAudienceTitle}</h2>
          <p className="mt-2 text-[var(--muted)]">{intro.audience}</p>
        </div>
      </div>
    </section>
  );
}
