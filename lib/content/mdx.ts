import { evaluate } from "@mdx-js/mdx";
import { createElement, type ReactElement } from "react";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { makeMdxComponents, type LessonContext } from "../../components/mdx/components.tsx";
import type { Lang } from "../i18n.ts";
import type { GlossaryTerm } from "./schemas.ts";

/** Exercise ids used in a lesson body, in order. */
export function exerciseIds(body: string): string[] {
  return [...body.matchAll(/<Exercise\s+id="([^"]+)"/g)].map((m) => m[1]);
}

/** Compiles a lesson body at build time. Only ever called on reviewed files in content/. */
export async function renderLessonBody(
  body: string,
  lang: Lang,
  glossary: GlossaryTerm[],
  ctx?: LessonContext,
): Promise<ReactElement> {
  const { default: Content } = await evaluate(body, { ...runtime, remarkPlugins: [remarkGfm] });
  return createElement(Content, { components: makeMdxComponents(lang, glossary, ctx) });
}
