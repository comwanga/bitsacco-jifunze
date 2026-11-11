import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import { PathHeader } from "@/components/roadmap/PathHeader";
import { PathTree } from "@/components/roadmap/PathTree";
import { buildTree } from "@/lib/content/tree";
import { listRoadmaps } from "@/lib/content/load";
import { t, type Lang } from "@/lib/i18n";

export const dynamicParams = false;
export function generateStaticParams() { return listRoadmaps().map((r) => ({ roadmap: r.id })); }
type Params = { params: Promise<{ lang: string; roadmap: string }> };
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, roadmap } = await params;
  const tree = buildTree(lang as Lang, roadmap);
  return pageMetadata(lang as Lang, `tree/${roadmap}/`, `${tree.title} · ${t(lang as Lang, "viewTree")}`, tree.description);
}
export default async function TreePage({ params }: Params) {
  const { lang: l, roadmap } = await params;
  const lang = l as Lang;
  const tree = buildTree(lang, roadmap);
  const lessons = tree.sections.flatMap((s) => s.lessons);
  return <>
    <PathHeader path={tree} lang={lang} slugs={lessons.map((l) => l.slug)} optionalSections={tree.sections.filter((s) => s.optional).map((s) => s.lessons.map((l) => l.slug))} minutes={lessons.reduce((sum, l) => sum + l.minutes, 0)} view="tree" />
    <PathTree tree={tree} lang={lang} />
  </>;
}
