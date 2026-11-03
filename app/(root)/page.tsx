/* eslint-disable @next/next/no-html-link-for-pages -- "/" has its own root layout, so a full page load is intended. */
export default function RootRedirect() {
  return (
    <>
      <meta httpEquiv="refresh" content="0;url=/sw/" />
      <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
        <p>
          Karibu Bitsacco Jifunze. <a href="/sw/">Endelea kwa Kiswahili</a> ·{" "}
          <a href="/en/">Continue in English</a>
        </p>
      </main>
    </>
  );
}
