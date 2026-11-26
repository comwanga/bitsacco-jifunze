import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { BookReader } from "@/components/books/BookReader";
import { pageMetadata } from "@/lib/page-metadata";
import { formatBytes } from "@/lib/format";
import type { Lang } from "@/lib/i18n";

type Params = { params: Promise<{ lang: string }> };
const book = () => JSON.parse(fs.readFileSync(path.resolve("public/books/kujifunza-bitcoin-sw-3rd-edition.source.json"), "utf8")) as {
  filename: string; bytes: number; pages: number; sha256: string; translationSource: string; translationRevision: string;
};
const TITLE = "Kujifunza Bitcoin: Kuprogramu Blockchain Huria — Toleo la 3";
export async function generateMetadata({ params }: Params) {
  const lang = (await params).lang as Lang;
  return pageMetadata(lang, "library/kujifunza-bitcoin/", "Kujifunza Bitcoin — Kiswahili, Toleo la 3",
    lang === "sw" ? "Soma na upakue PDF ya Kiswahili ya Mastering Bitcoin, toleo la 3, iliyotafsiriwa na comwanga." : "Read and download the Kiswahili PDF of Mastering Bitcoin, third edition, translated by comwanga.");
}
export default async function BookPage({ params }: Params) {
  const lang = (await params).lang as Lang;
  const meta = book();
  return <div className="mx-auto max-w-6xl px-4 pt-8 pb-16">
    <Link href={`/${lang}/library/`} className="underline">{lang === "sw" ? "Maktaba" : "Library"}</Link>
    <h1 className="mt-4 text-3xl font-extrabold" lang="sw">{TITLE}</h1>
    <p className="mt-3">Andreas M. Antonopoulos &amp; David A. Harding · {lang === "sw" ? "tafsiri ya Kiswahili:" : "Kiswahili translation by"} comwanga</p>
    <p className="mt-2">Kiswahili · {meta.pages} {lang === "sw" ? "kurasa" : "pages"} · {formatBytes(meta.bytes)} · <a href="https://creativecommons.org/licenses/by-sa/4.0/" className="underline" rel="license">CC BY-SA 4.0</a></p>
    <p className="mt-3 max-w-prose">{lang === "sw" ? "PDF hii imetengenezwa kutoka maandishi ya chanzo huria ya tafsiri. Si PDF rasmi ya mchapishaji. Maandishi ya tafsiri hayajabadilishwa." : "This PDF was generated from the open-source text of the translation. It is not a publisher’s PDF. The translated text has not been changed."}</p>
    <p className="mt-2 text-sm"><a className="underline" href={`${meta.translationSource}/tree/${meta.translationRevision}`}>{lang === "sw" ? "Chanzo cha tafsiri na toleo lililotumika" : "Translation source and exact revision"}</a></p>
    <BookReader lang={lang} url={`/books/${meta.filename}`} filename={meta.filename} bytes={meta.bytes} sha256={meta.sha256} title={lang === "sw" ? "Kujifunza Bitcoin, toleo la 3 — PDF ya Kiswahili" : "Kujifunza Bitcoin, third edition — Kiswahili PDF"} />
  </div>;
}
