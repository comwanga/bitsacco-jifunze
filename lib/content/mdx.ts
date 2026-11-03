import { evaluate } from "@mdx-js/mdx";
import { createElement, type ReactElement } from "react";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { makeMdxComponents } from "../../components/mdx/components.tsx";
import type { Lang } from "../i18n.ts";
import type { GlossaryTerm } from "./schemas.ts";

/** Compiles a lesson body at build time. Only ever called on reviewed files in content/. */
export async function renderLessonBody(body: string, lang: Lang, glossary: GlossaryTerm[]): Promise<ReactElement> {
  const { default: Content } = await evaluate(body, { ...runtime, remarkPlugins: [remarkGfm] });
  return createElement(Content, { components: makeMdxComponents(lang, glossary) });
}
