import "../globals.css";

export default function RootRedirectLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sw">
      <body>{children}</body>
    </html>
  );
}
