"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

// Keep an explicit choice during client navigation, without persistent storage.
// Separate static URLs keep both views usable on reload and without JavaScript.
let choice: "list" | "tree" = "tree";
export function choosePathView(view: "list" | "tree") { choice = view; }

export function PathPresentation({ tree, list }: { tree: ReactNode; list: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  useLayoutEffect(() => {
    if (choice === "list") {
      const [lang, roadmap] = pathname.split("/").filter(Boolean);
      router.replace(`/${lang}/list/${roadmap}/${window.location.hash}`, { scroll: false });
    }
  }, [pathname, router]);
  return choice === "list" ? list : tree;
}
