import { evaluate } from "@mdx-js/mdx";
import { createElement, type ReactElement } from "react";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { makeBlogMdxComponents } from "../../components/blog/mdx-components.tsx";
import type { Lang } from "../i18n.ts";
import { remarkHeadingIds } from "./headings.ts";
import type { GlossaryTerm } from "./schemas.ts";

/** Compiles a blog post body at build time: lesson components without labs, plus diagrams. */
export async function renderBlogBody(body: string, lang: Lang, glossary: GlossaryTerm[]): Promise<ReactElement> {
  const { default: Content } = await evaluate(body, { ...runtime, remarkPlugins: [remarkGfm, remarkHeadingIds] });
  return createElement(Content, { components: makeBlogMdxComponents(lang, glossary) });
}
