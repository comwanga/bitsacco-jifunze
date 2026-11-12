import type { ReactNode } from "react";
import { NavLink } from "./NavLink";
import { SiteMenu } from "./SiteMenu";

export type NavItem = { href: string; label: string; match: string[] };

// Current section: a lighter pill plus a dawn underline (desktop) or side bar (menu), so it never relies on colour alone.
const desktopLink =
  "block rounded-full px-3.5 py-2 text-[15px] font-medium text-white/80 hover:bg-white/10 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white aria-[current=page]:shadow-[inset_0_-2px_0_var(--color-dawn)]";
const menuLink =
  "flex items-center rounded-xl px-3 py-3 text-lg font-medium text-white/85 hover:bg-white/10 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white aria-[current=page]:shadow-[inset_3px_0_0_var(--color-dawn)]";

function Links({ items, className }: { items: NavItem[]; className: string }) {
  return items.map((item) => (
    <li key={item.href}>
      <NavLink href={item.href} match={item.match} className={className}>
        {item.label}
      </NavLink>
    </li>
  ));
}

/**
 * Site navigation. From 1024px the links, the language switch and the feedback action form one group on the right:
 * [brand] ....... [Paths Labs Library Glossary Progress | Language Feedback]. Narrower: language switch and a menu,
 * with feedback as the menu's last item. Feedback is a plain mailto link: no script, sign-in or request.
 */
export function HeaderNav({
  items,
  action,
  label,
  menuLabel,
  children,
}: {
  items: NavItem[];
  action?: { href: string; label: string };
  label: string;
  menuLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="ml-auto flex items-center gap-2 lg:gap-4">
      <nav aria-label={label} className="hidden lg:block">
        <ul className="flex items-center gap-1">
          <Links items={items} className={desktopLink} />
        </ul>
      </nav>
      <span aria-hidden="true" className="hidden h-6 w-px bg-white/20 lg:block" />
      {children}
      {/* After the language switch, not before it: the switch stays grouped with the section links. */}
      {action && <div className="hidden lg:block">
        <a href={action.href} className={desktopLink} data-header-feedback>
          {action.label}
        </a>
      </div>}
      <SiteMenu>
        <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-white/30 px-3.5 text-sm font-semibold text-white hover:bg-white/10 [&::-webkit-details-marker]:hidden">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path className="group-open:hidden" d="M3 5.5h14M3 10h14M3 14.5h14" />
            <path className="hidden group-open:block" d="M5 5l10 10M15 5L5 15" />
          </svg>
          {/* Below 380px the button is icon-only so the row fits with room for wider phone fonts; the name stays for screen readers. */}
          <span className="max-[379px]:sr-only">{menuLabel}</span>
        </summary>
        <nav
          aria-label={label}
          className="absolute inset-x-0 top-full max-h-[calc(100svh-var(--header-h))] overflow-auto border-t border-white/10 bg-night shadow-[0_16px_32px_-16px_rgb(6_9_28/0.7)]"
        >
          <ul className="mx-auto max-w-[96rem] px-2 py-2 sm:px-4 lg:px-6">
            <Links items={items} className={menuLink} />
            {action && <li><a href={action.href} className={menuLink} data-header-feedback>{action.label}</a></li>}
          </ul>
        </nav>
      </SiteMenu>
    </div>
  );
}
