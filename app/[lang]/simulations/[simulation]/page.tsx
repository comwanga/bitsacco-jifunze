import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimulationShell } from "@/components/simulations/SimulationShell";
import { getSimulation, SIMULATIONS } from "@/lib/simulations/registry";
import { validateSimulationLessons } from "@/lib/content/tree";
import type { Lang } from "@/lib/i18n";

export const dynamicParams = false;
export function generateStaticParams() {
  validateSimulationLessons(SIMULATIONS);
  return SIMULATIONS.map((s) => ({ simulation: s.id }));
}
type Params = { params: Promise<{ lang: string; simulation: string }> };
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, simulation } = await params;
  const entry = getSimulation(simulation);
  if (!entry) notFound();
  return { title: entry.title[lang as Lang], description: entry.description[lang as Lang] };
}
export default async function SimulationPage({ params }: Params) {
  const { lang, simulation } = await params;
  const entry = getSimulation(simulation);
  if (!entry) notFound();
  return <SimulationShell key={`${lang}/${simulation}`} entry={entry} lang={lang as Lang} />;
}
