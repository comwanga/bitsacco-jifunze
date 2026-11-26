import type { Lang } from "@/lib/i18n";
import { blogText } from "@/lib/blog/copy";

/** A plain link to a longer video elsewhere: no embed, so nothing loads from the video site until the reader taps. */
export function VideoLink({ href, poster, title, duration, lang }: { href: string; poster: string; title: string; duration: string; lang: Lang }) {
  const host = new URL(href).hostname.replace(/^www\./, "");
  return (
    <a
      data-video-link
      href={href}
      rel="noopener noreferrer"
      className="not-prose my-8 grid gap-3 rounded-xl border border-[var(--line)] p-3 no-underline hover:border-teal-600 sm:grid-cols-[14rem_1fr] sm:items-center"
    >
      <span className="relative block">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export serves the file as-is */}
        <img src={poster} alt="" className="h-auto w-full rounded-lg" />
        <span aria-hidden="true" className="absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full bg-black/60 text-xl text-white">
          ▶
        </span>
      </span>
      <span className="block">
        <span className="block font-bold text-[var(--fg)]">{title}</span>
        <span className="mt-1 block text-sm text-[var(--muted)]">{duration}</span>
        <span data-video-host className="mt-1 block text-sm text-teal-700 underline dark:text-teal-400">
          {blogText(lang, "blogVideoOpens").replace("{host}", host)}
        </span>
      </span>
    </a>
  );
}
