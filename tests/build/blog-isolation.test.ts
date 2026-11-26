import fs from "node:fs";
import { expect, test } from "vitest";

/** Imports from the blog's own modules, which must never reach pages that are not blog pages. */
export function blogImports(source: string): string[] {
  return [...source.matchAll(/from\s+["']([^"']*(?:components\/blog|lib\/blog|\.\.\/blog\/|content\/blog-mdx)[^"']*)["']/g)].map((m) => m[1]);
}

// Every page loads these; a blog import here once pushed every lesson page over its JavaScript budget.
const SHARED = ["components/mdx/components.tsx", "lib/content/mdx.ts", "lib/i18n.ts", "components/layout/SiteHeader.tsx", "components/layout/SiteFooter.tsx"];

test("shared modules every page loads never import blog code", () => {
  for (const file of SHARED) expect(blogImports(fs.readFileSync(file, "utf8")), file).toEqual([]);
});

test("the guard recognises the import that caused the budget regression", () => {
  expect(blogImports('import { Marker, makeDiagram } from "../blog/Diagram.tsx";')).toEqual(["../blog/Diagram.tsx"]);
  expect(blogImports('import { renderBlogBody } from "@/lib/content/blog-mdx";')).toEqual(["@/lib/content/blog-mdx"]);
});
