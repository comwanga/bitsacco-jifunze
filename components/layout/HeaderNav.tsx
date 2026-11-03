import Link from "next/link";
import type { ReactNode } from "react";
import { NavState } from "./NavState";

export type NavItem = { href: string; label: string; match: string[] };

const desktopLink =
  "block rounded-full px-3.5 py-2 text-[15px] font-medium text-white/80 hover:bg-white/10 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white aria-[current=page]:shadow-[inset_0_-2px_0_var(--color-dawn)]";
const menuLink =
  "flex items-center rounded-xl px-3 py-3 text-lg font-medium text-white/85 hover:bg-white/10 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white aria-[current=page]:shadow-[inset_3px_0_0_var(--color-dawn)]";

function Links({ items, className }: { items: NavItem[]; className: string }) {
  return items.map((item) => (
    <li key={item.href}>
      <Link href={item.href} data-nav-match={item.match.join(" ")} className={className}>
        {item.label}
      </Link>
    </li>
  ));
}

/**
 * Site navigation, rendered on the server. From 1024px: one inline row. Narrower: a <details> menu that opens
 * without JavaScript. NavState adds the current-page marker and closes the menu (Escape, outside tap, navigation).
 */
export function HeaderNav({ items, label, menuLabel, children }: { items: NavItem[]; label: string; menuLabel: string; children: ReactNode }) {
  return (
    <>
      <nav aria-label={label} className="hidden lg:block">
        <ul className="flex items-center gap-1">
          <Links items={items} className={desktopLink} />
        </ul>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {children}
        <details data-site-menu className="group lg:hidden">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-white/30 px-3.5 text-sm font-semibold text-white hover:bg-white/10 [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path className="group-open:hidden" d="M3 5.5h14M3 10h14M3 14.5h14" />
              <path className="hidden group-open:block" d="M5 5l10 10M15 5L5 15" />
            </svg>
            {menuLabel}
          </summary>
          <nav
            aria-label={label}
            className="absolute inset-x-0 top-full max-h-[calc(100svh-var(--header-h))] overflow-auto border-t border-white/10 bg-night shadow-[0_16px_32px_-16px_rgb(6_9_28/0.7)]"
          >
            <ul className="mx-auto max-w-6xl px-2 py-2 sm:px-4">
              <Links items={items} className={menuLink} />
            </ul>
          </nav>
        </details>
      </div>
      <NavState />
    </>
  );
}
