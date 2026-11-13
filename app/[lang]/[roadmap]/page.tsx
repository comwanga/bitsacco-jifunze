import { pageMetadata } from "@/lib/page-metadata";
import { getRoadmap, listRoadmaps } from "@/lib/content/load";
import type { RoadmapId } from "@/lib/content/schemas";
import type { Lang } from "@/lib/i18n";
import { PathPresentation } from "@/components/roadmap/PathPresentation";
import TreePage from "../tree/[roadmap]/page";
import ListPage from "../list/[roadmap]/page";

export const dynamicParams = false;
export function generateStaticParams() { return listRoadmaps().map((r) => ({ roadmap: r.id })); }
type Params = { params: Promise<{ lang: string; roadmap: string }> };

export async function generateMetadata({ params }: Params) {
  const { lang, roadmap } = await params;
  const r = getRoadmap(roadmap as RoadmapId);
  return pageMetadata(lang as Lang, `${roadmap}/`, r.title[lang as Lang], r.description[lang as Lang]);
}

export default async function RoadmapPage({ params }: Params) {
  const tree = await TreePage({ params });
  const list = await ListPage({ params });
  return <PathPresentation tree={tree} list={list} />;
}
