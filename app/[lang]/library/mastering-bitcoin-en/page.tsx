import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { BookReader } from "@/components/books/BookReader";
import { pageMetadata } from "@/lib/page-metadata";
import { formatBytes } from "@/lib/format";
import type { Lang } from "@/lib/i18n";

type Params = { params: Promise<{ lang: string }> };
const book = () => JSON.parse(fs.readFileSync(path.resolve("public/books/mastering-bitcoin-en-3rd-edition.source.json"), "utf8")) as {
  filename: string; bytes: number; pages: number; sha256: string; revision: string;
};
export async function generateMetadata({ params }: Params) {
  const lang = (await params).lang as Lang;
  return pageMetadata(lang, "library/mastering-bitcoin-en/", "Mastering Bitcoin — English, Third Edition",
    lang === "sw" ? "Soma na upakue PDF ya Kiingereza iliyotengenezwa kutoka chanzo rasmi." : "Read and download the English PDF generated from the official open-source text.");
}
export default async function BookPage({ params }: Params) {
  const lang = (await params).lang as Lang;
  const meta = book();
  return <div className="mx-auto max-w-6xl px-4 pt-8 pb-16">
    <Link href={`/${lang}/library/`} className="underline">{lang === "sw" ? "Maktaba" : "Library"}</Link>
    <h1 className="mt-4 text-3xl font-extrabold" lang="en">Mastering Bitcoin: Programming the Open Blockchain — Third Edition</h1>
    <p className="mt-3">Andreas M. Antonopoulos &amp; David A. Harding</p>
    <p className="mt-2">English · {meta.pages} {lang === "sw" ? "kurasa" : "pages"} · {formatBytes(meta.bytes)} · <a href="https://creativecommons.org/licenses/by-sa/4.0/" className="underline" rel="license">CC BY-SA 4.0</a></p>
    <p className="mt-3 max-w-prose">{lang === "sw" ? "PDF hii imetengenezwa kutoka maandishi rasmi ya chanzo huria. Si PDF rasmi ya mchapishaji. Maandishi ya kitabu hayajaandikwa upya wala kutafsiriwa." : "This PDF was generated from the official open-source text. It is not the publisher’s official PDF. The book text has not been rewritten or translated."}</p>
    <p className="mt-2 text-sm"><a className="underline" href={`https://github.com/bitcoinbook/bitcoinbook/tree/${meta.revision}`}>{lang === "sw" ? "Chanzo rasmi na toleo lililotumika" : "Official source and exact revision"}</a></p>
    <BookReader lang={lang} url={`/books/${meta.filename}`} filename={meta.filename} bytes={meta.bytes} sha256={meta.sha256} />
  </div>;
}
