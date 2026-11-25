// Shared by the map generator (scripts/build-world-dots.ts) and the homepage markers, so both line up.
// Equirectangular projection, cropped to 84°N–58°S (drops Antarctica), 1000 units wide.
export const MAP = { width: 1000, latTop: 84, latBottom: -58 } as const;
export const MAP_HEIGHT = (MAP.width * (MAP.latTop - MAP.latBottom)) / 360;

export function project(lat: number, lon: number): { x: number; y: number } {
  return {
    x: ((lon + 180) / 360) * MAP.width,
    y: ((MAP.latTop - lat) / (MAP.latTop - MAP.latBottom)) * MAP_HEIGHT,
  };
}
