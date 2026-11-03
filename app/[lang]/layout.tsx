import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { isLang, LANGS, t, type Lang } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import "../globals.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: "#1b2550",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : "sw";
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t(l, "siteName"), template: `%s | ${t(l, "siteName")}` },
    description: t(l, "heroLead"),
    alternates: { languages: { sw: "/sw/", en: "/en/" } },
    icons: { icon: "/logo.svg" },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang}>
      <body className="min-h-screen antialiased">
        <SiteHeader lang={lang} />
        <main id="main">{children}</main>
        <SiteFooter lang={lang} />
      </body>
    </html>
  );
}
