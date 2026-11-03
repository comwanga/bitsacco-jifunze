"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A header link that knows if it is the current section. usePathname is read during render, so the
 * prerendered HTML already carries aria-current, before any script runs. Choosing a link in the phone
 * menu closes the menu. No prefetch: these links are on screen on every page, and prefetching their routes
 * would cost every visitor data and make each page's measured JavaScript depend on prefetch timing.
 */
export function NavLink({ href, match, className, children }: { href: string; match: string[]; className: string; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={match.some((m) => path.startsWith(m)) ? "page" : undefined}
      onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
      className={className}
    >
      {children}
    </Link>
  );
}
