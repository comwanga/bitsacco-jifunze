import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import { SIMULATIONS } from "@/lib/simulations/registry";
import { simulationCopy } from "@/lib/simulations/copy";

type Params = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  const c = simulationCopy[lang];
  return pageMetadata(lang, "simulations/", c.indexTitle, c.indexLead);
}
export default async function SimulationsPage({ params }: Params) {
  const lang = (await params).lang as Lang;
  const c = simulationCopy[lang];
  return <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
    <h1 className="text-3xl font-extrabold tracking-tight">{c.indexTitle}</h1>
    <p className="mt-3 text-lg text-[var(--muted)]">{c.indexLead}</p>
    <ul className="mt-8 grid gap-5 sm:grid-cols-2">{SIMULATIONS.map((entry) => <li key={entry.id} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
      <h2 className="text-xl font-bold"><Link prefetch={false} href={`/${lang}/simulations/${entry.id}/`} className="text-teal-700 underline underline-offset-4 dark:text-teal-400">{entry.title[lang]}</Link></h2>
      <p className="mt-3 text-[var(--muted)]">{entry.description[lang]}</p>
    </li>)}</ul>
  </div>;
}
