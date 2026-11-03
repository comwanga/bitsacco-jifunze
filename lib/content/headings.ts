import { createProcessor } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";

export type Heading = { depth: 2 | 3; text: string; id: string };

type Node = {
  type: string;
  depth?: number;
  value?: string;
  children?: Node[];
  data?: { hProperties?: Record<string, unknown> };
};

/** URL-safe id from heading text: lowercase, accents removed, letters (any script) and digits kept, words joined by "-". */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "sehemu";
}

function textOf(node: Node): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

/** Every ## and ### in document order, paired with its unique id. The one place ids are decided. */
function collect(tree: Node): { node: Node; heading: Heading }[] {
  const out: { node: Node; heading: Heading }[] = [];
  const seen = new Map<string, number>();
  const used = new Set<string>();
  const walk = (node: Node) => {
    if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
      const text = textOf(node).replace(/\s+/g, " ").trim();
      const base = slugify(text);
      let n = (seen.get(base) ?? 0) + 1;
      let id = n === 1 ? base : `${base}-${n}`;
      while (used.has(id)) id = `${base}-${++n}`;
      seen.set(base, n);
      used.add(id);
      out.push({
        node,
        heading: {
          depth: node.depth,
          text,
          id,
        },
      });
      return;
    }
    node.children?.forEach(walk);
  };
  walk(tree);
  return out;
}

/** The lesson's ## and ### headings, parsed exactly as the renderer parses them (code fences are not headings). */
export function extractHeadings(body: string): Heading[] {
  const tree = createProcessor({ remarkPlugins: [remarkGfm] }).parse(body) as unknown as Node;
  return collect(tree).map((c) => c.heading);
}

/** Remark plugin: puts the same ids as extractHeadings on the rendered h2/h3 elements. */
export function remarkHeadingIds() {
  return (tree: unknown) => {
    for (const { node, heading } of collect(tree as Node)) {
      node.data = {
        ...node.data,
        hProperties: { ...node.data?.hProperties, id: heading.id },
      };
    }
  };
}
