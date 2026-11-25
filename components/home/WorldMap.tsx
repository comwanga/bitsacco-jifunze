import type { WorldGroup } from "@/lib/content/schemas";
import { MAP, MAP_HEIGHT, project } from "@/lib/map/project";

// Label placement per marker, so nearby names (chama in Nairobi, upatu in Dar es Salaam) do not overlap.
const LABEL: Record<string, { dx: number; dy: number; anchor: "start" | "end" }> = {
  chama: { dx: -12, dy: -8, anchor: "end" },
  upatu: { dx: 12, dy: 16, anchor: "start" },
  susu: { dx: -12, dy: 8, anchor: "end" },
  pandero: { dx: -12, dy: 8, anchor: "end" },
};
const DEFAULT_LABEL = { dx: 12, dy: 8, anchor: "start" as const };

/** The generated dot map with one marker and name per savings group. Decorative: the list below carries the content. */
export function WorldMap({ groups }: { groups: WorldGroup[] }) {
  const viewBox = `0 0 ${MAP.width} ${MAP_HEIGHT.toFixed(1)}`;
  return (
    <figure data-world-map className="relative mt-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export with unoptimized images */}
      <img src="/images/world-dots.svg" alt="" width={MAP.width} height={Math.round(MAP_HEIGHT)} className="block h-auto w-full" />
      <svg viewBox={viewBox} aria-hidden="true" className="absolute inset-0 h-full w-full text-[var(--fg)]">
        {groups.map((g) => {
          const { x, y } = project(g.lat, g.lon);
          const l = LABEL[g.id] ?? DEFAULT_LABEL;
          return (
            <g key={g.id} data-marker={g.id}>
              <circle cx={x} cy={y} r="8" fill="#ff5800" stroke="#fff" strokeWidth="3" />
              <text
                x={x + l.dx}
                y={y + l.dy}
                textAnchor={l.anchor}
                fontSize="24"
                fontWeight="700"
                fill="currentColor"
                stroke="var(--surface-warm)"
                strokeWidth="5"
                paintOrder="stroke"
              >
                {g.name}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
