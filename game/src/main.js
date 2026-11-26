// Dawn Patrol over the Strait — main loop and game state.
// A small prop plane, the Dawn Kestrel, takes off from Kestrel Field at
// dawn, threads eight glowing rings over a coastal strait past a lighthouse,
// and lands back on the strip. Keyboard and mouse; sound is synthesised.
import { createFlight, resetFlight, updateFlight, passedRing, distanceToRing } from './flight.js';
import { RINGS } from './world.js';
import { drawScene } from './render.js';
import { drawPanel, drawTopHud, drawMessage, drawTitle, drawEndCard } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { readShotPreset, applyShotPreset } from './shots.js';
import { clamp } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const flight = createFlight();
const input = createInput(canvas);
const audio = createAudio();

const state = {
  mode: 'title', // title | flying | paused | crashed | landed | won
  score: 0,
  elapsed: 0,
  nextRing: 0,
  nextRingDist: 0,
  ringsHit: new Set(),
  message: '',
  messageSub: '',
  messageUntil: 0,
  landedAt: 0,
};

const shot = readShotPreset();
let shotTime = 0;
if (shot) {
  shotTime = applyShotPreset(flight, shot);
  state.mode = 'flying';
  state.nextRing = shot.nextRing;
  state.ringsHit = new Set(shot.ringsHit);
  state.score = shot.score;
  state.elapsed = shot.elapsed;
  state.nextRingDist = shot.nextRing < RINGS.length
    ? distanceToRing(flight, RINGS[shot.nextRing])
    : 0;
}

function showMessage(text, sub, seconds) {
  state.message = text;
  state.messageSub = sub || '';
  state.messageUntil = performance.now() + seconds * 1000;
}

function startFlight() {
  resetFlight(flight);
  state.mode = 'flying';
  state.score = 0;
  state.elapsed = 0;
  state.nextRing = 0;
  state.nextRingDist = distanceToRing(flight, RINGS[0]);
  state.ringsHit = new Set();
  state.message = '';
  audio.unlock();
  showMessage('Take off! Full throttle with W, then pull up.', 'Fly through the glowing rings in order.', 5);
  announce('Dawn Patrol: take off and fly through the eight rings.');
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let t = shot ? shotTime : 0;

function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  if (!shot) t += dt;

  // --- input that works in every mode ---
  if (input.wasPressed('m')) {
    audio.setMuted(!audio.isMuted());
    showMessage(audio.isMuted() ? 'Sound off' : 'Sound on', '', 1.5);
  }
  if (input.wasPressed('r') && state.mode !== 'title') {
    startFlight();
  }
  if (input.wasPressed('p') && state.mode === 'flying') {
    state.mode = 'paused';
    showMessage('Paused', 'Press P to keep flying.', 60);
  } else if (input.wasPressed('p') && state.mode === 'paused') {
    state.mode = 'flying';
  }
  if (state.mode === 'title' && (input.wasPressed('Enter') || input.wasPressed(' ') || input.wasClicked())) {
    audio.unlock();
    startFlight();
  }
  if ((state.mode === 'crashed' || state.mode === 'landed' || state.mode === 'won') &&
      (input.wasPressed('Enter') || input.wasClicked())) {
    startFlight();
  }

  // --- simulation ---
  if (state.mode === 'flying' && !shot) {
    state.elapsed += dt;
    const stick = input.stick();
    const th = input.throttle();
    updateFlight(flight, {
      pitch: stick.pitch,
      roll: stick.roll,
      throttleUp: th.up,
      throttleDown: th.down,
    }, dt);

    // Ring collection.
    if (state.nextRing < RINGS.length) {
      const ring = RINGS[state.nextRing];
      state.nextRingDist = distanceToRing(flight, ring);
      if (passedRing(flight, ring)) {
        state.ringsHit.add(state.nextRing);
        state.score += 250;
        audio.ring();
        showMessage(`Ring ${state.nextRing + 1} of 8 — +250`, state.nextRing + 1 < 8 ? 'Next ring is glowing gold.' : 'All rings! Land on Kestrel Field.', 2.5);
        announce(`Ring ${state.nextRing + 1} of 8. Score ${state.score}.`);
        state.nextRing += 1;
      }
    } else {
      state.nextRingDist = 0;
    }

    if (flight.crashed) {
      state.mode = 'crashed';
      audio.crash();
      announce('Crashed. ' + flight.crashReason);
    } else if (flight.landed && state.nextRing >= RINGS.length) {
      state.mode = 'won';
      const bonus = Math.max(200, 1000 - Math.floor(state.elapsed) * 3);
      state.score += bonus;
      audio.win();
      announce(`Landed! Mission complete. Score ${state.score}.`);
    } else if (flight.landed) {
      state.mode = 'landed';
      announce('Landed on Kestrel Field. Press R to take off again.');
    }
  }

  // Gentle idle bob on the title screen so the scene lives.
  if (state.mode === 'title' && !shot) {
    flight.throttle = 0.3 + Math.sin(t * 0.8) * 0.05;
  }

  audio.update(flight.throttle, flight.speed, state.mode === 'flying');

  // --- render ---
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  ctx.clearRect(0, 0, W, H);
  drawScene(ctx, flight, state, W, H, t);
  drawPanel(ctx, flight, W, H);
  if (state.mode !== 'title') drawTopHud(ctx, state, flight, W, H);
  if (state.message && now < state.messageUntil && state.mode === 'flying') {
    drawMessage(ctx, state.message, state.messageSub, W, H);
  }
  if (state.mode === 'title' && !shot) drawTitle(ctx, W, H, t);
  if (state.mode === 'paused') drawMessage(ctx, 'Paused', 'Press P to keep flying.', W, H);
  if (state.mode === 'crashed') {
    drawEndCard(ctx, 'Down in the strait', [
      flight.crashReason,
      `Rings flown: ${state.ringsHit.size} of 8 · Score ${state.score}`,
    ], W, H);
  }
  if (state.mode === 'landed') {
    drawEndCard(ctx, 'Down safely — but the rings wait', [
      `You landed with ${8 - state.ringsHit.size} ring${8 - state.ringsHit.size === 1 ? '' : 's'} still to fly.`,
      `Score ${state.score} · Press R to take off again.`,
    ], W, H);
  }
  if (state.mode === 'won') {
    drawEndCard(ctx, 'Mission complete!', [
      `All 8 rings and a landing on Kestrel Field in ${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}.`,
      `Final score: ${state.score}`,
    ], W, H);
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

announce('Dawn Patrol over the Strait. Press Enter to take off.');
// Tiny debug hook for automated play-tests (read-only state, no cheats).
window.__dawnPatrol = { flight, state };
requestAnimationFrame(frame);
