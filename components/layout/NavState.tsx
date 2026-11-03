"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Renders nothing. Marks the header link for the current section with aria-current, and closes the phone menu
 * after navigating, on Escape (returning focus to its button) and on a tap outside it.
 */
export function NavState() {
  const pathname = usePathname() ?? "/";
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;

  useEffect(() => {
    for (const a of document.querySelectorAll<HTMLElement>("[data-nav-match]")) {
      if (a.dataset.navMatch!.split(" ").some((m) => path.startsWith(m))) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    for (const d of document.querySelectorAll<HTMLDetailsElement>("details[data-site-menu]")) d.open = false;
  }, [path]);

  useEffect(() => {
    const menu = () => document.querySelector<HTMLDetailsElement>("details[data-site-menu][open]");
    const onKey = (e: KeyboardEvent) => {
      const d = menu();
      if (e.key !== "Escape" || !d) return;
      d.open = false;
      d.querySelector("summary")?.focus();
    };
    const onClick = (e: MouseEvent) => {
      const d = menu();
      if (d && !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
