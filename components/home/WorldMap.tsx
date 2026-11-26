import type { WorldGroup } from "@/lib/content/schemas";
import { MAP, MAP_HEIGHT, project } from "@/lib/map/project";
import "./world-map.css";

// Payment "channels" drawn between the groups, Lightning-style. Every id must exist in content/world-groups.json.
const ARCS: [string, string][] = [
  ["pandero", "susu"],
  ["susu", "chama"],
  ["chama", "arisan"],
  ["arisan", "stokvel"],
  ["stokvel", "pandero"],
  ["susu", "stokvel"],
  ["upatu", "arisan"],
  ["chama", "upatu"],
];

/** A curve that bows upward between two points, so routes read as arcs over the globe. */
function arcPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
): string {
  const lift = Math.hypot(b.x - a.x, b.y - a.y) * 0.3;
  const cx = (a.x + b.x) / 2;
  const cy = Math.min(a.y, b.y) - lift;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

// Label placement per marker, so nearby names (chama in Nairobi, upatu in Dar es Salaam) do not overlap.
const LABEL: Record<
  string,
  { dx: number; dy: number; anchor: "start" | "end" }
> = {
  chama: { dx: -12, dy: -8, anchor: "end" },
  upatu: { dx: 12, dy: 16, anchor: "start" },
  susu: { dx: -12, dy: 8, anchor: "end" },
  pandero: { dx: -12, dy: 8, anchor: "end" },
};
const DEFAULT_LABEL = { dx: 12, dy: 8, anchor: "start" as const };

/**
 * The generated dot map with a pulsing marker and name per savings group, and flowing payment routes between them.
 * Decorative: the list below carries the content.
 */
export function WorldMap({ groups }: { groups: WorldGroup[] }) {
  const viewBox = `0 0 ${MAP.width} ${MAP_HEIGHT.toFixed(1)}`;
  const at = new Map(groups.map((g) => [g.id, project(g.lat, g.lon)]));
  const arcs = ARCS.map(([from, to]) => {
    const a = at.get(from);
    const b = at.get(to);
    if (!a || !b)
      throw new Error(
        `World map route ${from}–${to} names a group missing from content/world-groups.json`,
      );
    return { id: `${from}-${to}`, d: arcPath(a, b) };
  });
  return (
    <figure data-world-map className="world-map mt-6">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export with unoptimized images */}
        <img
          src="/images/world-dots.svg"
          alt=""
          width={MAP.width}
          height={Math.round(MAP_HEIGHT)}
          className="block h-auto w-full"
        />
        <svg
          viewBox={viewBox}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full text-[var(--fg)]"
        >
          {arcs.map((arc) => (
            <path
              key={arc.id}
              data-arc={arc.id}
              className="map-arc"
              d={arc.d}
            />
          ))}
          {groups.map((g, i) => {
            const { x, y } = project(g.lat, g.lon);
            const l = LABEL[g.id] ?? DEFAULT_LABEL;
            return (
              <g key={g.id} data-marker={g.id}>
                <circle
                  data-pulse
                  className={`map-pulse map-pulse-${i + 1}`}
                  cx={x}
                  cy={y}
                  r="8"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="8"
                  fill="#ff5800"
                  stroke="#fff"
                  strokeWidth="3"
                />
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
      </div>
    </figure>
  );
}
