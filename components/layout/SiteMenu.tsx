"use client";

import type { ReactNode } from "react";

/**
 * The phone menu: a native <details>, so it opens and closes without JavaScript. Once hydrated, Escape
 * closes it and returns focus to its button, and it closes when focus moves outside it.
 */
export function SiteMenu({ children }: { children: ReactNode }) {
  return (
    <details
      data-site-menu
      className="group lg:hidden"
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !e.currentTarget.open) return;
        e.currentTarget.open = false;
        e.currentTarget.querySelector("summary")?.focus();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.open = false;
      }}
    >
      {children}
    </details>
  );
}
