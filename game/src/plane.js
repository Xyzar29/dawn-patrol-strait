// The Dawn Kestrel: a small single-prop plane drawn with canvas paths in
// chase view — tail towards us, nose pointing up-screen, wings spread.
// Banks with the flight roll; the propeller spins and the nav lights blink.
import { clamp } from './util.js';

export function drawPlane(ctx, cx, cy, scale, f, t) {
  const s = 74 * scale; // half-wingspan in pixels
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(f.roll * 0.85);
  // Main wings: warm cream with red tips, slight dihedral.
  ctx.fillStyle = '#f3e6c8';
  ctx.beginPath();
  ctx.moveTo(-s, 6 * scale);
  ctx.quadraticCurveTo(-s * 0.4, -6 * scale, 0, -4 * scale);
  ctx.quadraticCurveTo(s * 0.4, -6 * scale, s, 6 * scale);
  ctx.quadraticCurveTo(s * 0.5, 12 * scale, 0, 10 * scale);
  ctx.quadraticCurveTo(-s * 0.5, 12 * scale, -s, 6 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8442e';
  ctx.beginPath();
  ctx.moveTo(-s, 6 * scale);
  ctx.lineTo(-s * 0.86, 4 * scale);
  ctx.lineTo(-s * 0.86, 9 * scale);
  ctx.lineTo(-s, 10 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s, 6 * scale);
  ctx.lineTo(s * 0.86, 4 * scale);
  ctx.lineTo(s * 0.86, 9 * scale);
  ctx.lineTo(s, 10 * scale);
  ctx.closePath();
  ctx.fill();

  // Fuselage: tapered body from tail (bottom) to nose (top).
  const bodyGrad = ctx.createLinearGradient(0, -s * 1.15, 0, s * 0.55);
  bodyGrad.addColorStop(0, '#e8b64c');
  bodyGrad.addColorStop(0.45, '#d98a2b');
  bodyGrad.addColorStop(1, '#a34d1d');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.18);
  ctx.quadraticCurveTo(13 * scale, -s * 0.7, 11 * scale, -s * 0.1);
  ctx.quadraticCurveTo(10 * scale, s * 0.3, 7 * scale, s * 0.52);
  ctx.quadraticCurveTo(0, s * 0.6, -7 * scale, s * 0.52);
  ctx.quadraticCurveTo(-10 * scale, s * 0.3, -11 * scale, -s * 0.1);
  ctx.quadraticCurveTo(-13 * scale, -s * 0.7, 0, -s * 1.18);
  ctx.closePath();
  ctx.fill();
  // Centre stripe.
  ctx.strokeStyle = 'rgba(120, 40, 10, 0.55)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.05);
  ctx.lineTo(0, s * 0.5);
  ctx.stroke();

  // Canopy: dark glass with a dawn glint.
  ctx.fillStyle = '#1d2b3a';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.42, 7.5 * scale, 13 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 220, 160, 0.85)';
  ctx.beginPath();
  ctx.ellipse(-2.5 * scale, -s * 0.48, 2.2 * scale, 5 * scale, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Tailplane and fin.
  ctx.fillStyle = '#e8d9b8';
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, s * 0.42);
  ctx.lineTo(0, s * 0.3);
  ctx.lineTo(s * 0.42, s * 0.42);
  ctx.lineTo(s * 0.34, s * 0.56);
  ctx.lineTo(-s * 0.34, s * 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8442e';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.3);
  ctx.lineTo(5 * scale, s * 0.62);
  ctx.lineTo(-5 * scale, s * 0.62);
  ctx.closePath();
  ctx.fill();

  // Propeller: spinning disc at the nose with two blurred blades.
  const propAngle = t * (6 + f.throttle * 26);
  const px = 0;
  const py = -s * 1.18;
  ctx.save();
  ctx.globalAlpha = 0.22 + f.throttle * 0.1;
  ctx.fillStyle = '#cfd6dd';
  ctx.beginPath();
  ctx.ellipse(px, py, 15 * scale, 15 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(propAngle);
  ctx.fillStyle = 'rgba(30, 28, 26, 0.85)';
  ctx.fillRect(-1.6 * scale, -15 * scale, 3.2 * scale, 30 * scale);
  ctx.rotate(Math.PI / 2);
  ctx.fillRect(-1.6 * scale, -15 * scale, 3.2 * scale, 30 * scale);
  ctx.restore();
  // Spinner.
  ctx.fillStyle = '#f3e6c8';
  ctx.beginPath();
  ctx.arc(px, py, 3.4 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Nav lights: red port, green starboard, white tail strobe.
  const blink = Math.sin(t * 6) > 0;
  ctx.save();
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ff3b30';
  ctx.shadowColor = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-s * 0.98, 7 * scale, 2.6 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#35e065';
  ctx.shadowColor = '#35e065';
  ctx.beginPath();
  ctx.arc(s * 0.98, 7 * scale, 2.6 * scale, 0, Math.PI * 2);
  ctx.fill();
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, s * 0.6, 2.2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

// Small top-down silhouette used on the title screen.
export function drawPlaneIcon(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#f3e6c8';
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.lineTo(0, -s * 0.28);
  ctx.lineTo(s, 0);
  ctx.lineTo(0, s * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d98a2b';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.16, s * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
