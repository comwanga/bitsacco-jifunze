import type { Metadata } from "next";
import NotFound from "./[lang]/not-found";
import "./globals.css";

// The app has two root layouts ((root) and [lang]), so unmatched URLs need this routing-level page.
// It bypasses the layouts: styles are imported here and both languages are shown.
export const metadata: Metadata = {
  title: "Ukurasa haupatikani · Page not found",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="sw">
      <body className="flex min-h-screen flex-col antialiased">
        <main id="main" className="flex-1">
          <NotFound />
        </main>
      </body>
    </html>
  );
}
