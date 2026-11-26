// The world of Dawn Patrol over the Strait: a coastal strait at dawn.
// One big headland island holds Kestrel Field runway; a lighthouse rock,
// two more islands and scattered islets give the strait its shape. All
// heights are metres; y = 0 is sea level. Nothing here is copied from any
// commercial game: the names, places and layout are invented for this game.
import { clamp, smoothstep, mulberry32 } from './util.js';

export const SEA_LEVEL = 0;

// Gaussian island bumps: { x, z, sigma, height }.
export const ISLANDS = [
  { x: 0, z: 320, sigma: 360, height: 24, name: 'Kestrel Headland' },
  { x: -460, z: -1150, sigma: 190, height: 42, name: 'Lantern Rock' },
  { x: 720, z: -650, sigma: 330, height: 36, name: 'Gull Isle' },
  { x: -780, z: 420, sigma: 400, height: 32, name: 'West Hook' },
  { x: 180, z: -2050, sigma: 430, height: 48, name: 'Far Ember Isle' },
  { x: -150, z: -2600, sigma: 500, height: 40, name: 'North Break' },
  { x: 1150, z: 250, sigma: 260, height: 22, name: 'Driftwood Cay' },
  { x: -1250, z: -900, sigma: 300, height: 26, name: 'Grey Gull Rock' },
  { x: 950, z: -1600, sigma: 240, height: 30, name: 'Ember Point' },
];

// Small islets for texture near the course.
const ISLETS = (() => {
  const rng = mulberry32(20261126);
  const out = [];
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const r = 500 + rng() * 2200;
    out.push({
      x: Math.cos(a) * r * 1.15,
      z: 300 - Math.sin(a) * r,
      sigma: 40 + rng() * 70,
      height: 6 + rng() * 12,
    });
  }
  return out;
})();

// Kestrel Field runway: a flat strip on the headland, pointing north.
export const RUNWAY = {
  x: 0,
  zStart: -120,
  zEnd: 520,
  width: 44,
  elevation: 8,
  headingDeg: 0, // runway points north (towards -z in world terms below)
};

// The lighthouse stands on Lantern Rock.
export const LIGHTHOUSE = { x: -460, z: -1150, baseHeight: 30, towerHeight: 52 };

// Gentle deterministic ripple so the terrain is not perfectly smooth.
function ripple(x, z) {
  return (
    Math.sin(x * 0.021 + z * 0.013) * 1.1 +
    Math.sin(x * 0.043 - z * 0.031) * 0.7 +
    Math.sin((x + z) * 0.008) * 1.4
  );
}

function bump(x, z, b) {
  const dx = (x - b.x) / b.sigma;
  const dz = (z - b.z) / b.sigma;
  const d2 = dx * dx + dz * dz;
  if (d2 > 4) return 0;
  // Super-Gaussian: a flat top with a sharp coastline, so islands end and
  // the strait stays open water instead of a fading green smear.
  return b.height * Math.exp(-d2 * d2 * 0.5);
}

export function terrainHeight(x, z) {
  let h = 0;
  for (const b of ISLANDS) h += bump(x, z, b);
  for (const b of ISLETS) h += bump(x, z, b);
  if (h > 0.4) h += ripple(x, z) * smoothstep(0.4, 6, h);
  // Flatten a valley along the runway strip to its elevation so takeoff and
  // landing work and the hills stay clear of the strip. The valley extends
  // past both thresholds as a gentle overrun so a long landing is forgiving.
  const dxRun = Math.abs(x - RUNWAY.x);
  const zIn = z >= RUNWAY.zStart - 80 && z <= RUNWAY.zEnd + 160;
  if (zIn) {
    const edge = smoothstep(200, 60, dxRun);
    const zTaper =
      z < RUNWAY.zStart
        ? smoothstep(RUNWAY.zStart - 80, RUNWAY.zStart, z) * 0.25 + 0.75
        : z > RUNWAY.zEnd
          ? smoothstep(RUNWAY.zEnd + 160, RUNWAY.zEnd, z) * 0.25 + 0.75
          : 1;
    const blend = edge * zTaper;
    h = h * (1 - blend) + RUNWAY.elevation * blend;
  }
  return Math.max(h, -2);
}

// The ring course: eight glowing rings over the strait, out around the
// lighthouse and back to the runway. y is the ring centre altitude.
export const RINGS = [
  { x: 0, z: -260, y: 95, r: 30 },
  { x: 300, z: -800, y: 115, r: 30 },
  { x: -200, z: -1050, y: 125, r: 30 },
  { x: -520, z: -1330, y: 120, r: 30 },
  { x: 120, z: -1850, y: 145, r: 32 },
  { x: 900, z: -1100, y: 130, r: 30 },
  { x: 800, z: -450, y: 110, r: 30 },
  { x: 120, z: -40, y: 80, r: 30 },
];

// Clouds drift slowly; seeded so screenshots are reproducible.
export const CLOUDS = (() => {
  const rng = mulberry32(77);
  const out = [];
  for (let i = 0; i < 16; i++) {
    out.push({
      x: (rng() - 0.5) * 5200,
      z: 400 - rng() * 3400,
      y: 420 + rng() * 280,
      s: 70 + rng() * 110,
      puffs: 3 + Math.floor(rng() * 3),
      seed: Math.floor(rng() * 100000),
    });
  }
  return out;
})();

// A couple of little fishing boats anchored in the strait.
export const BOATS = [
  { x: 320, z: -900, heading: 0.6 },
  { x: -180, z: -1500, heading: 2.4 },
  { x: 620, z: 150, heading: 1.2 },
];

export function isOnRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.width * 0.5 &&
    z >= RUNWAY.zStart &&
    z <= RUNWAY.zEnd
  );
}

// The landable zone is a little wider than the painted strip and extends
// past both thresholds: a long landing touches down instead of crashing.
export function isLandable(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.width * 0.5 + 8 &&
    z >= RUNWAY.zStart - 50 &&
    z <= RUNWAY.zEnd + 30
  );
}

export function runwayCentreZ() {
  return (RUNWAY.zStart + RUNWAY.zEnd) / 2;
}
