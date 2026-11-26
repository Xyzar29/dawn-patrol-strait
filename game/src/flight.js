// Arcade flight model for the Dawn Kestrel: throttle, pitch and roll with
// a banked turn, lift that depends on speed, a stall, and ground/water
// collision. Distances in metres, speeds in m/s, angles in radians.
// Heading 0 is north (-z), 90 deg is east (+x), as on a compass.
import { clamp, wrapAngle, deg2rad } from './util.js';
import { terrainHeight, isLandable, RUNWAY } from './world.js';

export const MAX_SPEED = 86; // m/s at full throttle, level flight
export const STALL_SPEED = 27; // m/s: below this the nose drops
export const CRUISE_SPEED = 52;

export function createFlight() {
  return {
    // Parked at the south end of Kestrel Field, facing north down the strip.
    x: 0,
    y: RUNWAY.elevation + 1.6,
    z: 470,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    verticalSpeed: 0,
    onGround: true,
    airborne: false,
    crashed: false,
    landed: false,
    crashReason: '',
  };
}

export function resetFlight(f) {
  const fresh = createFlight();
  Object.assign(f, fresh);
}

// input: { pitch: -1..1 (positive = pull up), roll: -1..1 (positive = right),
//          throttleUp, throttleDown } — all already smoothed by main.js.
export function updateFlight(f, input, dt) {
  if (f.crashed || f.landed) return;

  // Throttle.
  if (input.throttleUp) f.throttle = clamp(f.throttle + dt * 0.55, 0, 1);
  if (input.throttleDown) f.throttle = clamp(f.throttle - dt * 0.7, 0, 1);

  // Pitch and roll ease towards the commanded deflection.
  const pitchTarget = input.pitch * 0.62;
  const rollTarget = input.roll * 1.05;
  f.pitch += (pitchTarget - f.pitch) * Math.min(1, dt * 3.2);
  f.roll += (rollTarget - f.roll) * Math.min(1, dt * 3.6);

  // Banked turn: banking right (positive roll) turns the nose right, so
  // the heading increases; the turn tightens as speed falls.
  const turnRate = Math.tan(f.roll) * (9.81 / Math.max(f.speed, 18)) * 0.9;
  f.heading = wrapAngle(f.heading + turnRate * dt);

  // Speed chases the throttle setting; drag grows in a climb.
  const targetSpeed = f.throttle * MAX_SPEED;
  const drag = 1 + Math.max(0, Math.sin(f.pitch)) * 1.4;
  const accel = (targetSpeed - f.speed) * 0.22 * drag;
  f.speed = Math.max(0, f.speed + accel * dt);

  // Lift: the wing only holds the plane up above stall speed.
  const stalled = f.speed < STALL_SPEED;
  let climb = Math.sin(f.pitch) * f.speed;
  if (stalled) {
    climb -= (STALL_SPEED - f.speed) * 0.55;
    // The nose drops in a stall.
    f.pitch += (deg2rad(-9) - f.pitch) * Math.min(1, dt * 1.4);
  }

  // Move along the flight path.
  const fx = Math.sin(f.heading);
  const fz = -Math.cos(f.heading);
  const horiz = Math.cos(f.pitch) * f.speed;
  f.x += fx * horiz * dt;
  f.z += fz * horiz * dt;
  f.y += climb * dt;
  f.verticalSpeed = climb;

  // Stay inside the playable strait; turn the pilot back gently at the edge.
  const r = Math.hypot(f.x, f.z - 300);
  if (r > 3200) {
    const back = Math.atan2(-f.x, -(f.z - 300));
    f.heading = wrapAngle(f.heading + wrapAngle(back - f.heading) * Math.min(1, dt * 1.5));
  }

  // Ground / water contact.
  const ground = terrainHeight(f.x, f.z);
  const clearance = f.y - ground;
  const overRunway = isLandable(f.x, f.z);

  // Parked or rolling on the strip: stay glued to the runway until the
  // pilot has speed and pulls up.
  if (f.onGround && overRunway && clearance < 3.5) {
    f.y = RUNWAY.elevation + 1.6;
    f.verticalSpeed = 0;
    // Rolling resistance and brakes: the strip slows the plane unless the
    // pilot is pushing real throttle for another takeoff.
    f.speed = Math.max(0, f.speed - 6 * dt);
    if (f.speed > 34 && f.pitch > 0.06) {
      f.onGround = false; // rotate — airborne now
      f.airborne = true;
    } else {
      f.pitch += (0 - f.pitch) * Math.min(1, dt * 2);
      f.roll *= Math.max(0, 1 - dt * 2);
      if (f.airborne && f.speed < 2 && f.throttle < 0.05) f.landed = true;
      return;
    }
  }

  if (clearance <= 0.4) {
    if (overRunway && Math.abs(f.verticalSpeed) < 4.5 && f.speed < 48 && Math.abs(f.pitch) < 0.22) {
      // A gentle touchdown on the strip.
      f.y = RUNWAY.elevation + 1.6;
      f.onGround = true;
      f.pitch = 0;
      f.roll *= 0.5;
      f.verticalSpeed = 0;
      f.speed = Math.max(0, f.speed - 26 * dt);
      if (f.airborne && f.speed < 2) f.landed = true;
    } else {
      f.crashed = true;
      f.crashReason = ground > 1 ? 'You flew into the hillside.' : 'You ditched into the strait.';
      f.y = ground + 0.4;
    }
    return;
  }
  f.onGround = false;
  if (f.y < 1.2 && !overRunway) {
    // Skimming the water.
    f.crashed = true;
    f.crashReason = 'You ditched into the strait.';
  }
}

// Did the plane just fly through ring `ring`? Returns true once per pass.
export function passedRing(f, ring) {
  const dx = f.x - ring.x;
  const dy = f.y - ring.y;
  const dz = f.z - ring.z;
  const d = Math.hypot(dx, dy, dz);
  return d < ring.r * 0.92;
}

// Distance from the plane to a ring centre, for the HUD beacon.
export function distanceToRing(f, ring) {
  return Math.hypot(f.x - ring.x, f.y - ring.y, f.z - ring.z);
}
