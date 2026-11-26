// Screenshot presets for Dawn Patrol over the Strait.
// ?shot=start|play|ring|end&seed=N renders one fixed, deterministic scene
// so the maker's screenshots are real renders of the game's own code:
//   start — parked on Kestrel Field at dawn, runway ahead, instruments lit
//   play  — mid-flight over the strait, next ring glowing ahead
//   ring  — threading a ring with the lighthouse behind it
//   end   — final approach, low over glittering water towards the strip
// In shot mode the game renders the frozen scene with the HUD on and no
// title or end overlays.
import { deg2rad } from './util.js';

const PRESETS = {
  start: {
    x: 0, y: 9.6, z: 470, heading: deg2rad(0), pitch: 0, roll: 0,
    speed: 0, throttle: 0.35, onGround: true,
    t: 42, nextRing: 0, ringsHit: [], score: 0, elapsed: 0,
  },
  play: {
    x: 350, y: 180, z: -1250, heading: deg2rad(60), pitch: deg2rad(2), roll: deg2rad(-8),
    speed: 58, throttle: 0.72, onGround: false,
    t: 96, nextRing: 5, ringsHit: [0, 1, 2, 3, 4], score: 1250, elapsed: 200,
  },
  ring: {
    x: -200, y: 128, z: -900, heading: deg2rad(-60), pitch: deg2rad(-2), roll: deg2rad(12),
    speed: 62, throttle: 0.78, onGround: false,
    t: 150, nextRing: 3, ringsHit: [0, 1, 2], score: 750, elapsed: 132,
  },
  end: {
    x: -30, y: 45, z: -700, heading: deg2rad(175), pitch: deg2rad(-3), roll: deg2rad(-3),
    speed: 40, throttle: 0.45, onGround: false,
    t: 210, nextRing: 8, ringsHit: [0, 1, 2, 3, 4, 5, 6, 7], score: 2000, elapsed: 264,
  },
};

export function readShotPreset() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  if (!name || !PRESETS[name]) return null;
  const seed = Number(params.get('seed') || '1');
  return { name, seed, ...PRESETS[name] };
}

// Apply a preset to a live flight state object; returns the fixed time.
export function applyShotPreset(flight, preset) {
  flight.x = preset.x;
  flight.y = preset.y;
  flight.z = preset.z;
  flight.heading = preset.heading;
  flight.pitch = preset.pitch;
  flight.roll = preset.roll;
  flight.speed = preset.speed;
  flight.throttle = preset.throttle;
  flight.onGround = preset.onGround;
  flight.crashed = false;
  flight.landed = false;
  flight.verticalSpeed = Math.sin(preset.pitch) * preset.speed;
  return preset.t;
}
