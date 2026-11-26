// Keyboard and mouse input for Dawn Patrol.
// Arrows pitch and bank · W / S throttle · A / D bank · mouse steers like a
// stick when it moves · R restart · M sound · Enter start · P pause.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0.5, y: 0.5, active: false, movedAt: 0 };
  let clicked = false;

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width;
    mouse.y = (e.clientY - rect.top) / rect.height;
    mouse.active = true;
    mouse.movedAt = performance.now();
  });
  canvas.addEventListener('pointerdown', () => {
    clicked = true;
  });

  return {
    // -1..1 pitch command (positive = pull up), -1..1 roll (positive = right).
    stick() {
      let pitch = 0;
      let roll = 0;
      if (keys.has('ArrowUp')) pitch += 1;
      if (keys.has('ArrowDown')) pitch -= 1;
      if (keys.has('ArrowLeft') || keys.has('a')) roll -= 1;
      if (keys.has('ArrowRight') || keys.has('d')) roll += 1;
      // Mouse stick: only while the pointer moved recently and no key is
      // steering the same axis.
      const fresh = performance.now() - mouse.movedAt < 2600;
      if (fresh && mouse.active) {
        if (roll === 0) roll = (mouse.x - 0.5) * 2.4;
        if (pitch === 0) pitch = -(mouse.y - 0.5) * 2.0;
      }
      return {
        pitch: Math.max(-1, Math.min(1, pitch)),
        roll: Math.max(-1, Math.min(1, roll)),
      };
    },
    throttle() {
      return {
        up: keys.has('w') || keys.has('Shift') || keys.has('=') || keys.has('+'),
        down: keys.has('s') || keys.has('Control') || keys.has('-') || keys.has('_'),
      };
    },
    wasPressed(k) {
      return pressed.has(k);
    },
    wasClicked() {
      return clicked;
    },
    endFrame() {
      pressed.clear();
      clicked = false;
    },
  };
}
