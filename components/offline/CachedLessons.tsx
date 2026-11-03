"use client";

import { useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";

/** Lists lesson pages the service worker has cached. `titles` maps "/sw/savers/x/" to a title. */
export function CachedLessons({ lang, titles }: { lang: Lang; titles: Record<string, string> }) {
  const [paths, setPaths] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = new Set<string>();
        for (const name of await caches.keys()) {
          if (!name.startsWith("pages-")) continue;
          const cache = await caches.open(name);
          for (const req of await cache.keys()) {
            const p = new URL(req.url).pathname;
            if (titles[p]) found.add(p);
          }
        }
        if (!cancelled) setPaths([...found]);
      } catch {
        if (!cancelled) setPaths([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [titles]);

  return (
    <section className="mt-8" aria-labelledby="cached">
      <h2 id="cached" className="text-xl font-bold">
        {t(lang, "offlineCached")}
      </h2>
      {paths && paths.length === 0 && <p className="mt-2 text-[var(--muted)]">{t(lang, "offlineNone")}</p>}
      {paths && paths.length > 0 && (
        <ul className="mt-3 space-y-2">
          {paths.map((p) => (
            <li key={p}>
              <a href={p} className="font-semibold text-teal-700 underline dark:text-teal-400">
                {titles[p]}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
