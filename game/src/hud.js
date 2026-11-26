// Cockpit instruments and HUD for Dawn Patrol over the Strait.
// The bottom panel holds lit gauges — artificial horizon, altimeter,
// airspeed, compass and throttle — and the top bar shows digital
// ALT / SPD / HDG, score, rings and the mission clock.
import { clamp, deg2rad, fmtInt, fmtTime } from './util.js';

const PANEL_H = 108;
const AMBER = '#ffb84d';
const CYAN = '#7fe3f2';
const PANEL_BG = 'rgba(10, 14, 22, 0.88)';

function roundGauge(ctx, cx, cy, r, label, drawFace) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0d1420';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 184, 77, 0.7)';
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.clip();
  drawFace(ctx, cx, cy, r);
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.font = `600 ${Math.max(9, r * 0.24)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r + 13);
  ctx.restore();
}

function drawHorizon(ctx, cx, cy, r, f) {
  // Sky / ground split, rotated by roll and shifted by pitch.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-f.roll);
  const pitchPx = clamp(f.pitch, -0.6, 0.6) * r * 1.4;
  ctx.beginPath();
  ctx.rect(-r, -r, r * 2, r * 2);
  ctx.clip();
  ctx.fillStyle = '#3f6ea6';
  ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
  ctx.strokeStyle = '#f5f0dc';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-r, -pitchPx);
  ctx.lineTo(r, -pitchPx);
  ctx.stroke();
  ctx.restore();
  // Fixed wings marker.
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy);
  ctx.lineTo(cx - r * 0.18, cy);
  ctx.moveTo(cx + r * 0.18, cy);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawNeedleGauge(ctx, cx, cy, r, value, min, max, ticks, unit) {
  const a0 = deg2rad(210);
  const a1 = deg2rad(-30);
  const frac = clamp((value - min) / (max - min), 0, 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= ticks; i++) {
    const a = a0 + (a1 - a0) * (i / ticks);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
    ctx.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
    ctx.stroke();
  }
  const a = a0 + (a1 - a0) * frac;
  ctx.strokeStyle = '#ff5a3c';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
  ctx.stroke();
  ctx.fillStyle = '#e8f4ff';
  ctx.font = `700 ${Math.max(11, r * 0.34)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(fmtInt(value), cx, cy + r * 0.42);
  ctx.fillStyle = 'rgba(232, 244, 255, 0.6)';
  ctx.font = `500 ${Math.max(8, r * 0.2)}px system-ui, sans-serif`;
  ctx.fillText(unit, cx, cy + r * 0.68);
}

function drawCompass(ctx, cx, cy, w, f) {
  // A moving heading strip: N/E/S/W ticks slide with the heading.
  const headingDeg = ((f.heading * 180) / Math.PI + 360) % 360;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, cy - 20, w, 40);
  ctx.clip();
  ctx.fillStyle = '#0d1420';
  ctx.fillRect(cx - w / 2, cy - 20, w, 40);
  const pxPerDeg = 2.4;
  const marks = [
    [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'],
    [225, 'SW'], [270, 'W'], [315, 'NW'], [360, 'N'],
  ];
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const [deg, label] of marks) {
    let d = deg - headingDeg;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    const x = cx + d * pxPerDeg;
    if (x < cx - w / 2 - 10 || x > cx + w / 2 + 10) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(x, cy - 8);
    ctx.lineTo(x, cy + 8);
    ctx.stroke();
    ctx.fillStyle = label.length === 1 ? AMBER : '#cfe8ff';
    ctx.fillText(label, x, cy + 17);
  }
  ctx.restore();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx, cy - 10);
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(headingDeg)).padStart(3, '0') + '°', cx, cy - 26);
}

export function drawPanel(ctx, f, W, H) {
  const y0 = H - PANEL_H;
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(0, y0, W, PANEL_H);
  ctx.fillStyle = 'rgba(255, 184, 77, 0.35)';
  ctx.fillRect(0, y0, W, 1.5);
  const cy = y0 + 44;
  const r = 34;

  // Artificial horizon.
  roundGauge(ctx, 62, cy, r, 'ATTITUDE', (c, x, y, rr) => drawHorizon(c, x, y, rr, f));
  // Altimeter (feet).
  const altFt = Math.max(0, f.y * 3.28084);
  roundGauge(ctx, 152, cy, r, 'ALT · FT', (c, x, y, rr) =>
    drawNeedleGauge(c, x, y, rr, altFt, 0, 2000, 8, 'FT'));
  // Airspeed (knots).
  const spdKt = f.speed * 1.94384;
  roundGauge(ctx, 242, cy, r, 'AIRSPEED · KT', (c, x, y, rr) =>
    drawNeedleGauge(c, x, y, rr, spdKt, 0, 180, 9, 'KT'));
  // Vertical speed (ft/min).
  const vsFpm = f.verticalSpeed * 196.85;
  roundGauge(ctx, 332, cy, r, 'VERT · FPM', (c, x, y, rr) =>
    drawNeedleGauge(c, x, y, rr, vsFpm, -2000, 2000, 8, 'FPM'));

  // Compass strip.
  drawCompass(ctx, W / 2 + 40, cy + 8, 300, f);

  // Throttle lever on the right.
  const tx = W - 66;
  ctx.fillStyle = '#0d1420';
  ctx.fillRect(tx - 8, y0 + 14, 16, 66);
  ctx.strokeStyle = 'rgba(255, 184, 77, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tx - 8, y0 + 14, 16, 66);
  const thY = y0 + 14 + 66 * (1 - f.throttle);
  ctx.fillStyle = AMBER;
  ctx.fillRect(tx - 12, thY - 4, 24, 8);
  ctx.fillStyle = AMBER;
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', tx, y0 + 94);
  ctx.fillStyle = '#e8f4ff';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText(Math.round(f.throttle * 100) + '%', tx, y0 + 12);

  // Stall warning lamp.
  const stalled = f.speed < 27 && !f.onGround;
  ctx.save();
  if (stalled) {
    ctx.shadowColor = '#ff3b30';
    ctx.shadowBlur = 14;
    ctx.fillStyle = Math.sin(Date.now() / 120) > 0 ? '#ff3b30' : '#7a1a12';
  } else {
    ctx.fillStyle = '#233042';
  }
  ctx.beginPath();
  ctx.arc(W - 116, y0 + 26, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = stalled ? '#ffb0a8' : 'rgba(232,244,255,0.45)';
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STALL', W - 116, y0 + 44);
}

export function drawTopHud(ctx, state, f, W, H) {
  const altFt = Math.max(0, f.y * 3.28084);
  const spdKt = f.speed * 1.94384;
  const hdg = ((f.heading * 180) / Math.PI + 360) % 360;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(8, 12, 20, 0.55)';
  ctx.fillRect(12, 10, 316, 56);
  ctx.fillStyle = '#fff2c0';
  ctx.fillText(`ALT ${fmtInt(altFt)} FT`, 22, 30);
  ctx.fillStyle = '#aee6ff';
  ctx.fillText(`SPD ${fmtInt(spdKt)} KT`, 22, 52);
  ctx.fillStyle = '#ffd24d';
  ctx.fillText(`HDG ${String(Math.round(hdg)).padStart(3, '0')}°`, 190, 30);
  ctx.fillStyle = '#e8f4ff';
  ctx.fillText(`RINGS ${state.ringsHit.size}/8`, 190, 52);
  // Score, timer, next-ring beacon, right side.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(8, 12, 20, 0.55)';
  ctx.fillRect(W - 228, 10, 216, 56);
  ctx.fillStyle = '#fff2c0';
  ctx.fillText(`SCORE ${state.score}`, W - 22, 30);
  ctx.fillStyle = '#aee6ff';
  ctx.fillText(`TIME ${fmtTime(state.elapsed)}`, W - 22, 52);
  if (state.nextRing < 8) {
    const d = state.nextRingDist;
    ctx.fillStyle = '#ffd24d';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`NEXT RING ${state.nextRing + 1} · ${fmtInt(d)} m`, W / 2, 30);
  }
  ctx.restore();
}

export function drawMessage(ctx, text, sub, W, H) {
  if (!text) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8, 12, 20, 0.6)';
  const w = Math.min(640, W * 0.7);
  ctx.fillRect(W / 2 - w / 2, H * 0.2, w, sub ? 76 : 52);
  ctx.fillStyle = '#fff2c0';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText(text, W / 2, H * 0.2 + 34);
  if (sub) {
    ctx.fillStyle = '#cfe8ff';
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillText(sub, W / 2, H * 0.2 + 60);
  }
  ctx.restore();
}

export function drawTitle(ctx, W, H, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 10, 24, 0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd9a0';
  ctx.font = '700 46px Georgia, serif';
  ctx.fillText('DAWN PATROL', W / 2, H * 0.3);
  ctx.fillStyle = '#fff2c0';
  ctx.font = 'italic 600 22px Georgia, serif';
  ctx.fillText('over the Strait', W / 2, H * 0.3 + 34);
  ctx.fillStyle = '#e8f4ff';
  ctx.font = '500 16px system-ui, sans-serif';
  ctx.fillText('Fly the Dawn Kestrel through all 8 rings, then land back on Kestrel Field.', W / 2, H * 0.44);
  ctx.fillText('↑ / ↓ pitch · ← / → bank · W / S throttle · mouse steers too · R restart · M sound', W / 2, H * 0.44 + 26);
  ctx.fillStyle = Math.sin(t * 3) > 0 ? '#ffd24d' : '#fff2c0';
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillText('Press ENTER or click to take off', W / 2, H * 0.58);
  ctx.restore();
}

export function drawEndCard(ctx, title, lines, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 10, 24, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd9a0';
  ctx.font = '700 38px Georgia, serif';
  ctx.fillText(title, W / 2, H * 0.32);
  ctx.fillStyle = '#e8f4ff';
  ctx.font = '500 17px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.42 + i * 28));
  ctx.fillStyle = '#ffd24d';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText('Press R to fly again', W / 2, H * 0.42 + lines.length * 28 + 26);
  ctx.restore();
}
