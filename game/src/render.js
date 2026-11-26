// Scene rendering for Dawn Patrol over the Strait: a dawn sky, a glittering
// sea, island terrain as a shaded heightfield mesh, the runway, the
// lighthouse, glowing rings, clouds and birds — all drawn on one 2D canvas
// with a small perspective projector. No images, no network: every pixel is
// computed here.
import { clamp, lerp, mulberry32, smoothstep } from './util.js';
import {
  terrainHeight,
  ISLANDS,
  RINGS,
  RUNWAY,
  LIGHTHOUSE,
  CLOUDS,
  BOATS,
} from './world.js';
import { drawPlane } from './plane.js';

const FOV = (62 * Math.PI) / 180;

// Sun low in the east, so the strait glitters at dawn.
const SUN_DIR = { x: 0.86, y: 0.34, z: -0.38 };
const SUN_AZIMUTH = Math.atan2(SUN_DIR.x, -SUN_DIR.z);

function makeCamera(f, W, H) {
  // Chase camera: behind and above the plane, looking ahead of it.
  const back = 13.5;
  const camUp = 4.6;
  const fx = Math.sin(f.heading);
  const fz = -Math.cos(f.heading);
  const cam = {
    x: f.x - fx * back,
    y: f.y + camUp,
    z: f.z - fz * back,
  };
  // Look target slightly ahead and below the nose.
  const tx = f.x + fx * 26;
  const ty = f.y - 1.2;
  const tz = f.z + fz * 26;
  let fwd = { x: tx - cam.x, y: ty - cam.y, z: tz - cam.z };
  const fl = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
  fwd = { x: fwd.x / fl, y: fwd.y / fl, z: fwd.z / fl };
  // Camera up, rolled with the plane so banks feel real.
  // right = fwd x world-up, so facing north (-z) gives right = +x (east).
  let right = { x: -fwd.z, y: 0, z: fwd.x };
  const rl = Math.hypot(right.x, right.z) || 1;
  right = { x: right.x / rl, y: 0, z: right.z / rl };
  // Up = cross(right, fwd), then rotate around fwd by the roll angle.
  let up2 = {
    x: right.y * fwd.z - right.z * fwd.y,
    y: right.z * fwd.x - right.x * fwd.z,
    z: right.x * fwd.y - right.y * fwd.x,
  };
  const ul = Math.hypot(up2.x, up2.y, up2.z) || 1;
  up2 = { x: up2.x / ul, y: up2.y / ul, z: up2.z / ul };
  const c = Math.cos(f.roll * 0.55);
  const s = Math.sin(f.roll * 0.55);
  const up = {
    x: up2.x * c + right.x * s,
    y: up2.y * c + right.y * s,
    z: up2.z * c + right.z * s,
  };
  const rightR = {
    x: right.x * c - up2.x * s,
    y: right.y * c - up2.y * s,
    z: right.z * c - up2.z * s,
  };
  const focal = (H / 2) / Math.tan(FOV / 2);
  return { pos: cam, fwd, right: rightR, up, focal, cx: W / 2, cy: H / 2 };
}

function project(cam, p) {
  const dx = p.x - cam.pos.x;
  const dy = p.y - cam.pos.y;
  const dz = p.z - cam.pos.z;
  const cz = dx * cam.fwd.x + dy * cam.fwd.y + dz * cam.fwd.z;
  if (cz < 1.5) return null;
  const cx = dx * cam.right.x + dy * cam.right.y + dz * cam.right.z;
  const cy = dx * cam.up.x + dy * cam.up.y + dz * cam.up.z;
  const s = cam.focal / cz;
  return { x: cam.cx + cx * s, y: cam.cy - cy * s, d: cz, s };
}

// Terrain colour by height, warmed by the dawn sun, hazed with distance.
function terrainColor(h, shade, haze) {
  let r;
  let g;
  let b;
  if (h < 2.5) {
    r = 216; g = 183; b = 128; // sand
  } else if (h < 14) {
    const t = (h - 2.5) / 11.5;
    r = lerp(96, 122, t); g = lerp(128, 148, t); b = lerp(66, 84, t); // meadow
  } else if (h < 26) {
    const t = (h - 14) / 12;
    r = lerp(122, 104, t); g = lerp(148, 116, t); b = lerp(84, 88, t); // high grass
  } else {
    const t = smoothstep(26, 42, h);
    r = lerp(104, 88, t); g = lerp(116, 92, t); b = lerp(88, 84, t); // rock
  }
  const warm = 1 + (1 - shade) * 0.12;
  r = r * shade * warm;
  g = g * shade;
  b = b * shade;
  // Dawn haze pulls far terrain towards the sky.
  const hz = clamp(haze, 0, 0.55);
  r = lerp(r, 168, hz);
  g = lerp(g, 132, hz);
  b = lerp(b, 148, hz);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function drawSky(ctx, cam, W, H, t) {
  // Horizon sits where the camera looks; pitch moves it up and down.
  const horizonY = cam.cy - (cam.fwd.y / Math.max(0.05, Math.hypot(cam.fwd.x, cam.fwd.z))) * cam.focal * 0.9;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b2350');
  g.addColorStop(0.34, '#4a3a72');
  g.addColorStop(0.52, '#b65f6e');
  g.addColorStop(0.62, '#ff9a56');
  g.addColorStop(0.66, '#ffd9a0');
  g.addColorStop(0.7, '#7fa8b8');
  g.addColorStop(1, '#274b63');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Sun: low in the east, big and warm, with a halo. It sits clear of the
  // horizon line so hills below the horizon never swallow it.
  const sunX = W * 0.72;
  const sunY = clamp(horizonY - 44, 30, H * 0.62);
  const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
  halo.addColorStop(0, 'rgba(255, 214, 140, 0.95)');
  halo.addColorStop(0.25, 'rgba(255, 170, 90, 0.55)');
  halo.addColorStop(1, 'rgba(255, 140, 70, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = '#fff3cf';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff8e0';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 13, 0, Math.PI * 2);
  ctx.fill();

  return horizonY;
}

function drawSea(ctx, cam, W, H, horizonY, t) {
  // Sea fills everything below the horizon.
  const g = ctx.createLinearGradient(0, horizonY, 0, H);
  g.addColorStop(0, '#f0a05e');
  g.addColorStop(0.12, '#a06a6e');
  g.addColorStop(0.3, '#3a6a84');
  g.addColorStop(1, '#16394f');
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.max(0, horizonY), W, H - Math.max(0, horizonY));

  // Sun glitter: short bright strokes on the water under the sun.
  const rng = mulberry32(1234);
  ctx.save();
  for (let i = 0; i < 80; i++) {
    const fx = rng();
    const fy = rng();
    const x = W * (0.52 + fx * 0.42);
    const y = horizonY + 6 + fy * fy * (H - horizonY - 8);
    const w = 4 + rng() * 22;
    const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.7 + i * 1.31));
    ctx.globalAlpha = 0.06 + 0.3 * tw * (1 - fy);
    ctx.fillStyle = i % 5 === 0 ? '#ffe9b0' : '#ffd9a0';
    ctx.fillRect(x - w / 2, y, w, 1.4);
  }
  ctx.restore();
}

function drawTerrain(ctx, cam, t) {
  // Heightfield mesh over the strait, drawn far-to-near.
  const CELL = 78;
  const x0 = -1750;
  const x1 = 1750;
  const z0 = -2900;
  const z1 = 1350;
  const quads = [];
  const camX = cam.pos.x;
  const camZ = cam.pos.z;
  for (let gx = x0; gx < x1; gx += CELL) {
    for (let gz = z0; gz < z1; gz += CELL) {
      const cx = gx + CELL / 2;
      const cz = gz + CELL / 2;
      const dc = Math.hypot(cx - camX, cz - camZ);
      if (dc > 2600) continue;
      const h00 = terrainHeight(gx, gz);
      const h10 = terrainHeight(gx + CELL, gz);
      const h01 = terrainHeight(gx, gz + CELL);
      const h11 = terrainHeight(gx + CELL, gz + CELL);
      if (Math.max(h00, h10, h01, h11) < 0.4) continue;
      const hAvg = (h00 + h10 + h01 + h11) / 4;
      // Simple normal from the height differences, shaded by the dawn sun.
      const nx = (h00 + h01 - h10 - h11) / (2 * CELL);
      const nz = (h00 + h10 - h01 - h11) / (2 * CELL);
      const nl = Math.hypot(nx, 1, nz);
      const dot = clamp(
        ((-nx / nl) * SUN_DIR.x + (1 / nl) * SUN_DIR.y + (-nz / nl) * SUN_DIR.z) * 0.5 + 0.5,
        0,
        1,
      );
      const shade = 0.62 + 0.48 * dot;
      // Per-quad jitter breaks the flat-colour look; haze softens distance.
      const jitter = 0.94 + 0.12 * (0.5 + 0.5 * Math.sin(gx * 12.9898 + gz * 78.233));
      const haze = clamp((dc - 1300) / 1300, 0, 1);
      quads.push({ gx, gz, h00, h10, h01, h11, hAvg, shade: shade * jitter, haze, d: dc });
    }
  }
  quads.sort((a, b) => b.d - a.d);
  for (const q of quads) {
    const p00 = project(cam, { x: q.gx, y: q.h00, z: q.gz });
    const p10 = project(cam, { x: q.gx + CELL, y: q.h10, z: q.gz });
    const p11 = project(cam, { x: q.gx + CELL, y: q.h11, z: q.gz + CELL });
    const p01 = project(cam, { x: q.gx, y: q.h01, z: q.gz + CELL });
    if (!p00 || !p10 || !p11 || !p01) continue;
    ctx.fillStyle = terrainColor(q.hAvg, q.shade, q.haze);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p00.x, p00.y);
    ctx.lineTo(p10.x, p10.y);
    ctx.lineTo(p11.x, p11.y);
    ctx.lineTo(p01.x, p01.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawRunway(ctx, cam) {
  const { x, zStart, zEnd, width, elevation } = RUNWAY;
  const hw = width / 2;
  // Draw the strip in short segments so the part behind the camera is
  // skipped instead of discarding the whole runway.
  ctx.fillStyle = '#3a3f46';
  for (let z = zStart; z < zEnd; z += 40) {
    const z2 = Math.min(z + 40, zEnd);
    const corners = [
      { x: x - hw, y: elevation, z },
      { x: x + hw, y: elevation, z },
      { x: x + hw, y: elevation, z: z2 },
      { x: x - hw, y: elevation, z: z2 },
    ].map((p) => project(cam, p));
    if (corners.some((p) => !p)) continue;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fill();
  }
  // Centreline dashes and threshold bars.
  ctx.fillStyle = '#f5f0dc';
  for (let z = zStart + 30; z < zEnd - 20; z += 60) {
    const a = project(cam, { x: x - 0.8, y: elevation + 0.2, z });
    const b = project(cam, { x: x + 0.8, y: elevation + 0.2, z: z + 20 });
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(a.x, b.y);
    ctx.closePath();
    ctx.fill();
  }
  // Edge lights: warm amber dots that read at dawn.
  ctx.save();
  ctx.shadowColor = '#ffb84d';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffd27a';
  for (let z = zStart; z <= zEnd; z += 58) {
    for (const sx of [-hw, hw]) {
      const p = project(cam, { x: x + sx, y: elevation + 0.6, z });
      if (!p || p.d > 2400) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, clamp(140 / p.d, 1, 4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  // Windsock near the strip (scale capped so it never fills the frame).
  const sock = project(cam, { x: 34, y: elevation + 12, z: 430 });
  if (sock && sock.d < 1600) {
    const ws = Math.min(sock.s, 2.2);
    ctx.strokeStyle = '#e8e2d0';
    ctx.lineWidth = Math.max(1, 90 / sock.d);
    ctx.beginPath();
    ctx.moveTo(sock.x, sock.y + 14 * ws);
    ctx.lineTo(sock.x, sock.y);
    ctx.stroke();
    ctx.fillStyle = '#ff7a3c';
    ctx.beginPath();
    ctx.moveTo(sock.x, sock.y);
    ctx.lineTo(sock.x + 16 * ws, sock.y + 3 * ws);
    ctx.lineTo(sock.x, sock.y + 6 * ws);
    ctx.closePath();
    ctx.fill();
  }
}

function drawLighthouse(ctx, cam, t) {
  const base = terrainHeight(LIGHTHOUSE.x, LIGHTHOUSE.z);
  const top = base + LIGHTHOUSE.towerHeight;
  const pBase = project(cam, { x: LIGHTHOUSE.x, y: base, z: LIGHTHOUSE.z });
  const pTop = project(cam, { x: LIGHTHOUSE.x, y: top, z: LIGHTHOUSE.z });
  if (!pBase || !pTop || pBase.d > 3000) return;
  const s = pBase.s;
  const w = Math.max(2, 11 * s);
  // Tower: white with two red bands.
  ctx.fillStyle = '#f2ede2';
  ctx.fillRect(pTop.x - w / 2, pTop.y, w, pBase.y - pTop.y);
  ctx.fillStyle = '#c8442e';
  const hgt = pBase.y - pTop.y;
  ctx.fillRect(pTop.x - w / 2, pTop.y + hgt * 0.3, w, hgt * 0.14);
  ctx.fillRect(pTop.x - w / 2, pTop.y + hgt * 0.62, w, hgt * 0.14);
  // Lamp room and cap.
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(pTop.x - w * 0.75, pTop.y - 6 * s, w * 1.5, 6 * s);
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.arc(pTop.x, pTop.y - 3 * s, Math.max(1.5, 2.4 * s), 0, Math.PI * 2);
  ctx.fill();
  // Rotating beam.
  const beamAngle = t * 0.55;
  const bx = Math.cos(beamAngle);
  const bz = Math.sin(beamAngle);
  const beamLen = 420;
  const end = project(cam, {
    x: LIGHTHOUSE.x + bx * beamLen,
    y: top + 6,
    z: LIGHTHOUSE.z + bz * beamLen,
  });
  if (end) {
    const grad = ctx.createLinearGradient(pTop.x, pTop.y, end.x, end.y);
    grad.addColorStop(0, 'rgba(255, 220, 130, 0.55)');
    grad.addColorStop(1, 'rgba(255, 220, 130, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pTop.x, pTop.y - 2 * s);
    ctx.lineTo(end.x, end.y - 26 * end.s);
    ctx.lineTo(end.x, end.y + 26 * end.s);
    ctx.lineTo(pTop.x, pTop.y + 2 * s);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRings(ctx, cam, nextRing, t, ringsHit) {
  const ordered = RINGS.map((r, i) => ({ ...r, i })).sort((a, b) => {
    const da = Math.hypot(a.x - cam.pos.x, a.y - cam.pos.y, a.z - cam.pos.z);
    const db = Math.hypot(b.x - cam.pos.x, b.y - cam.pos.y, b.z - cam.pos.z);
    return db - da;
  });
  for (const ring of ordered) {
    const c = project(cam, { x: ring.x, y: ring.y, z: ring.z });
    if (!c || c.d > 3200) continue;
    const done = ringsHit.has(ring.i);
    const isNext = ring.i === nextRing;
    const rx = ring.r * c.s;
    if (rx < 1.5) continue;
    const pulse = isNext ? 1 + 0.12 * Math.sin(t * 4) : 1;
    ctx.save();
    ctx.lineWidth = Math.max(2, 5 * c.s * 0.12 * pulse);
    if (done) {
      ctx.strokeStyle = 'rgba(120, 220, 140, 0.75)';
      ctx.shadowColor = '#78dc8c';
    } else if (isNext) {
      ctx.strokeStyle = '#ffd24d';
      ctx.shadowColor = '#ffb84d';
    } else {
      ctx.strokeStyle = 'rgba(90, 210, 235, 0.85)';
      ctx.shadowColor = '#5ad2eb';
    }
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx * pulse, rx * 0.94 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, 1.6 * c.s * 0.12);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx * 0.86 * pulse, rx * 0.8 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Distance tag on the next ring.
    if (isNext && rx > 14) {
      ctx.fillStyle = '#fff2c0';
      ctx.font = `bold ${Math.max(11, Math.min(20, rx * 0.22))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${ring.i + 1}`, c.x, c.y - rx - 10);
    }
    ctx.restore();
  }
}

function drawClouds(ctx, cam, t) {
  const list = CLOUDS.map((c) => {
    const drift = ((t * 2.2 + c.seed) % 600) - 300;
    return { ...c, x: c.x + drift };
  }).sort((a, b) => {
    const da = Math.hypot(a.x - cam.pos.x, a.y - cam.pos.y, a.z - cam.pos.z);
    const db = Math.hypot(b.x - cam.pos.x, b.y - cam.pos.y, b.z - cam.pos.z);
    return db - da;
  });
  for (const c of list) {
    const p = project(cam, { x: c.x, y: c.y, z: c.z });
    if (!p || p.d > 4200) continue;
    const s = c.s * p.s;
    if (s < 4) continue;
    const rng = mulberry32(c.seed);
    ctx.save();
    ctx.globalAlpha = clamp(0.55 - p.d / 5200, 0.18, 0.55);
    for (let i = 0; i < c.puffs; i++) {
      const ox = (rng() - 0.5) * s * 1.6;
      const oy = (rng() - 0.5) * s * 0.28;
      const r = s * (0.2 + rng() * 0.18);
      const g = ctx.createRadialGradient(p.x + ox, p.y + oy, 1, p.x + ox, p.y + oy, r);
      g.addColorStop(0, 'rgba(255, 226, 196, 0.55)');
      g.addColorStop(0.7, 'rgba(255, 205, 175, 0.32)');
      g.addColorStop(1, 'rgba(255, 205, 175, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x + ox, p.y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawBoats(ctx, cam) {
  for (const b of BOATS) {
    const p = project(cam, { x: b.x, y: 0.5, z: b.z });
    if (!p || p.d > 1800) continue;
    const s = p.s;
    ctx.fillStyle = '#5a3d2e';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 9 * s, 2.6 * s, b.heading, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d8d2c2';
    ctx.lineWidth = Math.max(1, 1.4 * s);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.sin(b.heading) * 8 * s, p.y - 10 * s);
    ctx.stroke();
  }
}

function drawBirds(ctx, cam, t) {
  const rng = mulberry32(555);
  ctx.save();
  ctx.strokeStyle = 'rgba(40, 32, 48, 0.85)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    const bx = cam.pos.x + (rng() - 0.5) * 500 + Math.sin(t * 0.2 + i) * 40;
    const bz = cam.pos.z - 120 - rng() * 320;
    const by = cam.pos.y + 18 + rng() * 40;
    const p = project(cam, { x: bx, y: by, z: bz });
    if (!p || p.d > 700) continue;
    const flap = Math.sin(t * 7 + i * 2.3) * 3;
    const s = clamp(420 / p.d, 0.5, 2.2);
    ctx.beginPath();
    ctx.moveTo(p.x - 6 * s, p.y - flap * s * 0.4);
    ctx.quadraticCurveTo(p.x, p.y + 2 * s, p.x + 6 * s, p.y - flap * s * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawScene(ctx, f, state, W, H, t) {
  const cam = makeCamera(f, W, H);
  const horizonY = drawSky(ctx, cam, W, H, t);
  drawSea(ctx, cam, W, H, horizonY, t);
  drawClouds(ctx, cam, t);
  drawTerrain(ctx, cam, t);
  drawRunway(ctx, cam);
  drawLighthouse(ctx, cam, t);
  drawBoats(ctx, cam);
  drawRings(ctx, cam, state.nextRing, t, state.ringsHit);
  drawBirds(ctx, cam, t);
  // The Dawn Kestrel herself, in chase view, with her shadow on the
  // ground or water below when she is low.
  const groundY = terrainHeight(f.x, f.z);
  const shadow = project(cam, { x: f.x, y: Math.max(groundY, 0) + 0.6, z: f.z });
  if (shadow && f.y - groundY < 220) {
    const alt = Math.max(0, f.y - groundY);
    ctx.save();
    ctx.globalAlpha = clamp(0.22 - alt / 900, 0.04, 0.22);
    ctx.fillStyle = '#101418';
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, 46 * shadow.s + 8, 12 * shadow.s + 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const planeScale = clamp(H / 480, 0.8, 1.6) * 1.12;
  drawPlane(ctx, W / 2, H * 0.62, planeScale, f, t);
  return cam;
}
