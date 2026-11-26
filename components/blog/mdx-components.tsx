import type { GlossaryTerm } from "../../lib/content/schemas.ts";
import type { Lang } from "../../lib/i18n.ts";
import { makeMdxComponents } from "../mdx/components.tsx";
import { Marker, makeDiagram } from "./Diagram.tsx";
import { Video } from "./Video.tsx";
import { VideoLink } from "./VideoLink.tsx";

// Kept apart from components/mdx/components.tsx so lesson pages never reference the blog's client components.
/** Blog posts: the lesson components without labs, plus labelled diagrams. */
export function makeBlogMdxComponents(lang: Lang, glossary: GlossaryTerm[]) {
  const { Term, Callout, table } = makeMdxComponents(lang, glossary);
  return {
    Term, Callout, table, Diagram: makeDiagram(lang), Marker, Exercise: () => null,
    Video: (props: { src: string; poster: string; captions: string; title: string }) => <Video {...props} lang={lang} />,
    VideoLink: (props: { href: string; poster: string; title: string; duration: string }) => <VideoLink {...props} lang={lang} />,
  };
}
