import Link from "next/link";
import type { Heading } from "@/lib/content/headings";
import { t, type Lang } from "@/lib/i18n";

type Item = Heading & { children: Heading[] };

function nest(headings: Heading[]): Item[] {
  const out: Item[] = [];
  for (const h of headings) {
    const parent = out.at(-1);
    if (h.depth === 3 && parent) parent.children.push(h);
    else out.push({ ...h, children: [] });
  }
  return out;
}

/** "On this page": the lesson's h2s with their h3s, then the next lesson. */
export function Toc({
  headings,
  lang,
  contentLang,
  next,
}: {
  headings: Heading[];
  lang: Lang;
  contentLang: Lang;
  next?: { href: string; title: string };
}) {
  return (
    <nav aria-label={t(lang, "onThisPage")} className="text-sm">
      <p className="font-bold">{t(lang, "onThisPage")}</p>
      <ul className="mt-2 space-y-1 border-l-2 border-[var(--line)]" lang={contentLang}>
        {nest(headings).map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              data-toc
              className="-ml-0.5 block border-l-2 border-transparent py-1 pl-3 text-[var(--muted)] hover:border-teal-600 hover:text-[var(--fg)]"
            >
              {h.text}
            </a>
            {h.children.length > 0 && (
              <ul>
                {h.children.map((c) => (
                  <li key={c.id}>
                    <a href={`#${c.id}`} data-toc className="block py-0.5 pl-6 text-[13px] text-[var(--muted)] hover:text-[var(--fg)]">
                      {c.text}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {next && (
        <p className="mt-5">
          <span className="block text-xs text-[var(--muted)]">{t(lang, "next")}</span>
          <Link href={next.href} className="font-semibold text-teal-700 hover:underline dark:text-teal-300" lang={contentLang}>
            {next.title}
          </Link>
        </p>
      )}
    </nav>
  );
}
