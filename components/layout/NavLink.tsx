"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A header link that knows if it is the current section. usePathname is read during render, so the
 * prerendered HTML already carries aria-current, before any script runs. Choosing a link in the phone
 * menu closes the menu.
 */
export function NavLink({ href, match, className, children }: { href: string; match: string[]; className: string; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return (
    <Link
      href={href}
      aria-current={match.some((m) => path.startsWith(m)) ? "page" : undefined}
      onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
      className={className}
    >
      {children}
    </Link>
  );
}
