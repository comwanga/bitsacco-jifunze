"use client";

import { useEffect, useRef } from "react";

/**
 * A 3px bar along the top that fills as the reader moves through the <article>.
 * It also closes the phone menus after a jump to a heading; the menus themselves are plain <details> and work without this.
 */
export function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const article = document.querySelector("article");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!article || !bar.current) return;
      const { top, height } = article.getBoundingClientRect();
      const span = height - window.innerHeight;
      const done = span <= 0 ? 1 : Math.min(1, Math.max(0, -top / span));
      bar.current.style.transform = `scaleX(${done})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const closeMenus = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest("[data-toc]")) {
        document.querySelectorAll<HTMLDetailsElement>("details[data-lesson-menu][open]").forEach((d) => (d.open = false));
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    document.addEventListener("click", closeMenus);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("click", closeMenus);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-[var(--header-h)] z-40 h-[3px]">
      <div
        ref={bar}
        data-reading-progress
        className="h-full origin-left bg-sun motion-safe:transition-transform motion-safe:duration-150"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
