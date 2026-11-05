import type { Metadata } from "next";
import { SITE_INDEXABLE, SITE_URL } from "@/lib/site";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  robots: SITE_INDEXABLE ? undefined : { index: false, follow: false },
};

export default function RootRedirectLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sw">
      <body>{children}</body>
    </html>
  );
}
