import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-20">
      <h1 className="text-3xl font-bold">Ukurasa haupatikani</h1>
      <p className="mt-1 text-lg text-[var(--muted)]" lang="en">
        Page not found
      </p>
      <p className="mt-6 flex gap-6">
        <Link className="font-semibold text-teal-700 underline" href="/sw/">
          Rudi mwanzo
        </Link>
        <Link className="font-semibold text-teal-700 underline" href="/en/" lang="en">
          Go home
        </Link>
      </p>
    </section>
  );
}
