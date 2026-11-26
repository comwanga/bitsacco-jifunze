"use client";

import { useState, useSyncExternalStore } from "react";
import { t, type Lang } from "@/lib/i18n";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * A short self-hosted clip. Nothing but the poster downloads until the reader presses play.
 * Offline (or when the file fails to load) a one-line note replaces the broken-player experience.
 */
export function Video({ src, poster, captions, title, lang }: { src: string; poster: string; captions: string; title: string; lang: Lang }) {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const [failed, setFailed] = useState(false);
  return (
    <figure data-video className="not-prose my-8">
      <video
        controls
        preload="none"
        playsInline
        poster={poster}
        onError={() => setFailed(true)}
        className="h-auto w-full rounded-xl border border-[var(--line)] bg-black"
      >
        <source src={src} type="video/mp4" onError={() => setFailed(true)} />
        <track kind="captions" src={captions} srcLang={lang} label={lang === "sw" ? "Kiswahili" : "English"} default />
      </video>
      <figcaption className="mt-2 text-sm text-[var(--muted)]">{title}</figcaption>
      <p data-video-offline hidden={online && !failed} className="mt-2 rounded-xl bg-dawn/20 p-3 text-sm">
        {t(lang, "blogVideoOffline")}
      </p>
    </figure>
  );
}
