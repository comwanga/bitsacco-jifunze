import { Children, isValidElement, type ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import { DiagramMarkers, type DiagramMarker } from "./DiagramMarkers";

type MarkerProps = { x: number; y: number; title: string; children?: ReactNode };

/** Placeholder for MDX: <Diagram> reads its <Marker> children's props; a lone Marker renders nothing. */
export function Marker(_props: MarkerProps) {
  return null;
}

export function makeDiagram(lang: Lang) {
  return function Diagram({ src, alt, children }: { src: string; alt: string; children?: ReactNode }) {
    const markers: DiagramMarker[] = [];
    for (const child of Children.toArray(children)) {
      if (!isValidElement<MarkerProps>(child) || typeof child.props.title !== "string") continue;
      markers.push({ n: markers.length + 1, x: Number(child.props.x), y: Number(child.props.y), title: child.props.title, text: child.props.children });
    }
    return (
      <figure data-diagram className="not-prose my-8">
        <DiagramMarkers src={src} alt={alt} markers={markers} lang={lang} />
      </figure>
    );
  };
}
