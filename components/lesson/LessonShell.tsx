import type { ReactNode } from "react";
import { t, type Lang } from "@/lib/i18n";
import { ReadingProgress } from "./ReadingProgress";

function PhoneMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details data-lesson-menu name="lesson-menu" className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {label}
        <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-180 motion-reduce:transition-none">
          ▾
        </span>
      </summary>
      <div className="absolute inset-x-0 top-full max-h-[70vh] overflow-auto border-b border-[var(--line)] bg-[var(--bg)] px-4 py-4 shadow-lg">
        {children}
      </div>
    </details>
  );
}

/**
 * Lesson layout. At 1100px and wider: course sidebar | article | "on this page".
 * Narrower: a sticky bar with two <details> menus holding the same navigation, which work without JavaScript.
 */
export function LessonShell({ lang, course, toc, children }: { lang: Lang; course: ReactNode; toc: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[96rem] min-[1100px]:grid min-[1100px]:grid-cols-[15rem_minmax(0,1fr)_13rem] min-[1100px]:gap-6 min-[1100px]:px-4">
      <ReadingProgress />
      <div className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur min-[1100px]:hidden">
        <div className="relative flex gap-2 px-4 py-2">
          <PhoneMenu label={t(lang, "courseNav")}>{course}</PhoneMenu>
          <PhoneMenu label={t(lang, "onThisPage")}>{toc}</PhoneMenu>
        </div>
      </div>
      <aside className="hidden min-[1100px]:block">
        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-auto py-6 pr-1">{course}</div>
      </aside>
      {children}
      <aside className="hidden min-[1100px]:block">
        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-auto py-6">{toc}</div>
      </aside>
    </div>
  );
}
