/**
 * The stone hall the fight takes place in, drawn in layers that scroll at
 * different speeds: the back wall and its windows, the pillars, the floor,
 * and a balustrade in front of the camera.
 */
export const GROUND = 560;
export const WORLD = { left: -600, right: 3200 };

/** Turn a parallax factor into a transform for that layer. */
function layer(ctx, camera, factor, view) {
  const zoom = 1 + (camera.zoom - 1) * factor;
  ctx.setTransform(zoom, 0, 0, zoom, view.width / 2 - camera.x * factor * zoom + camera.shakeX, view.height / 2 - camera.y * zoom + camera.shakeY);
}

/** A repeatable jagged wobble, so broken stone looks the same every frame. */
const jag = x => Math.sin(x * 0.091) * 18 + Math.sin(x * 0.37 + 1.3) * 9 + Math.sin(x * 1.7) * 4;

/**
 * Draw the hall. A scene may pass a `layout` whose `ruin: [from, to]` (world
 * x along the fight) breaks the hall open: through that stretch the back
 * wall crumbles away to sky and its pillars stand as stumps among rubble,
 * and past it the floor carries on as an open terrace under the sky.
 */
export function drawStage(ctx, camera, view, { dim = 0, time = 0, layout = null } = {}) {
  const { width, height } = view;
  const ruin = layout?.ruin ?? null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const wall = ctx.createLinearGradient(0, 0, 0, height);
  wall.addColorStop(0, '#7f848e');
  wall.addColorStop(0.55, '#a7abb3');
  wall.addColorStop(1, '#b9bcc3');
  if (ruin) {
    drawSky(ctx, camera, view);
  } else {
    // Sky-free interior: the wall fills the frame.
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, width, height);
  }

  // Back wall: stone courses and tall arched windows with light shafts.
  layer(ctx, camera, 0.55, view);
  ctx.save();
  if (ruin) {
    // The wall stands whole up to the ruin, crumbles through it, and is gone past it.
    const [from, to] = [ruin[0] * 0.55, ruin[1] * 0.55];
    const top = x => (x < from ? -1200 : -320 + ((x - from) / (to - from)) * (GROUND - 140 + 320) + jag(x));
    ctx.beginPath();
    ctx.moveTo(WORLD.left - 2000, GROUND + 20);
    ctx.lineTo(WORLD.left - 2000, -1200);
    for (let x = from; x <= to; x += 12) ctx.lineTo(x, top(x));
    ctx.lineTo(to, GROUND + 20);
    ctx.closePath();
    const shape = ctx.createLinearGradient(0, -400, 0, GROUND);
    shape.addColorStop(0, '#7f848e');
    shape.addColorStop(0.6, '#a7abb3');
    shape.addColorStop(1, '#b9bcc3');
    ctx.fillStyle = shape;
    ctx.fill();
    ctx.clip();
    // A darker broken edge along the top of the ruin.
    ctx.strokeStyle = '#5d626c';
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let x = from; x <= to; x += 12) (x === from ? ctx.moveTo(x, top(x)) : ctx.lineTo(x, top(x)));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(70,74,84,0.16)';
  ctx.lineWidth = 2;
  for (let y = -300; y < GROUND; y += 46) {
    ctx.beginPath();
    ctx.moveTo(WORLD.left - 800, y);
    ctx.lineTo(WORLD.right + 800, y);
    ctx.stroke();
    const offset = (Math.floor(y / 46) % 2) * 60;
    for (let x = WORLD.left - 800 + offset; x < WORLD.right + 800; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 46);
      ctx.stroke();
    }
  }
  for (let x = WORLD.left - 400; x < WORLD.right + 600; x += 430) {
    // Windows only where the wall still stands whole.
    if (!ruin || x < ruin[0] * 0.55 - 60) drawWindow(ctx, x, time);
  }
  ctx.restore();

  // Pillars in the middle distance: whole in the hall, broken in the ruin, gone past it.
  layer(ctx, camera, 0.8, view);
  for (let x = WORLD.left - 300; x < WORLD.right + 500; x += 640) {
    const along = x / 0.8;
    if (!ruin || along < ruin[0]) drawPillar(ctx, x);
    else if (along <= ruin[1]) drawPillar(ctx, x, GROUND - 200 - jag(x) * 3);
  }

  // The floor the fighters stand on.
  layer(ctx, camera, 1, view);
  const floor = ctx.createLinearGradient(0, GROUND - 4, 0, GROUND + 60);
  floor.addColorStop(0, '#e6e8ec');
  floor.addColorStop(0.25, '#cfd2d8');
  floor.addColorStop(1, '#a4a8b0');
  ctx.fillStyle = floor;
  ctx.fillRect(WORLD.left - 1200, GROUND - 4, WORLD.right - WORLD.left + 2400, 60);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(WORLD.left - 1200, GROUND - 5, WORLD.right - WORLD.left + 2400, 3);
  if (ruin) drawRubble(ctx, ruin);
  if (dim > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(20,6,12,${0.55 * dim})`;
    ctx.fillRect(0, 0, width, height);
  }
}

/** The open sky behind a broken hall: light and warm, so black figures still read against it. */
function drawSky(ctx, camera, view) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, view.height);
  sky.addColorStop(0, '#b9c7df');
  sky.addColorStop(0.55, '#f2d9c2');
  sky.addColorStop(1, '#fae8d4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.width, view.height);
  // A low sun, barely moving with the camera.
  layer(ctx, camera, 0.08, view);
  const sun = ctx.createRadialGradient(330, GROUND - 170, 10, 330, GROUND - 170, 260);
  sun.addColorStop(0, 'rgba(255,248,232,0.95)');
  sun.addColorStop(0.18, 'rgba(255,236,206,0.6)');
  sun.addColorStop(1, 'rgba(255,236,206,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(-400, -600, 1600, 1400);
  // Two ranges of distant mountains.
  for (const [factor, color, height, seed] of [[0.18, '#a9b2c5', 210, 0], [0.3, '#8d97ab', 150, 2.1]]) {
    layer(ctx, camera, factor, view);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-2000, GROUND + 40);
    for (let x = -2000; x <= 4000; x += 40) {
      const peak = Math.abs(Math.sin(x * 0.0021 + seed)) * height + Math.sin(x * 0.011 + seed) * 22;
      ctx.lineTo(x, GROUND - 10 - peak);
    }
    ctx.lineTo(4000, GROUND + 40);
    ctx.closePath();
    ctx.fill();
  }
}

/** Broken stone scattered across the floor of the ruin. */
function drawRubble(ctx, ruin) {
  ctx.fillStyle = '#6f747e';
  for (let x = ruin[0] - 80; x < ruin[1] + 200; x += 37) {
    const size = 6 + Math.abs(jag(x * 3)) * 0.5;
    if (Math.sin(x * 0.7) < -0.2) continue;
    ctx.beginPath();
    ctx.moveTo(x, GROUND - 2);
    ctx.lineTo(x + size * 0.3, GROUND - size * 0.8);
    ctx.lineTo(x + size, GROUND - size * 0.6);
    ctx.lineTo(x + size * 1.3, GROUND - 2);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Pillars standing in the fighters' own plane, which can be smashed. A
 * broken one is a jagged stump, its top having toppled over onto the floor.
 * `age` is how long ago it broke, in seconds, or null if it is whole.
 */
export function drawPlanePillar(ctx, x, age = null) {
  if (age === null) return drawPillar(ctx, x);
  const stump = GROUND - 150;
  drawPillar(ctx, x, stump + jag(x) * 0.6);
  // The top half falls away from the blow and lands along the floor.
  const fall = Math.min(1, age / 0.5) ** 2;
  const angle = fall * (Math.PI / 2) * 0.96;
  const length = 300;
  ctx.save();
  // It pivots on the break and drops as it tips, so it comes to rest on the floor.
  ctx.translate(x + 35, stump + fall * (GROUND - stump));
  ctx.rotate(angle);
  const body = ctx.createLinearGradient(-35, 0, 35, 0);
  body.addColorStop(0, '#4a4e57');
  body.addColorStop(0.35, '#6f747e');
  body.addColorStop(1, '#3c4048');
  ctx.fillStyle = body;
  // Drawn from the break upward, then rotated down onto the floor.
  ctx.beginPath();
  ctx.moveTo(-70, 0);
  for (let u = -70; u <= 0; u += 7) ctx.lineTo(u, -jag(x + u) * 0.4);
  ctx.lineTo(0, -length);
  ctx.lineTo(-70, -length);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The balustrade between the camera and the fight, drawn after the fighters. */
export function drawForeground(ctx, camera, view, { dim = 0 } = {}) {
  layer(ctx, camera, 1.18, view);
  const top = GROUND + 46;
  ctx.fillStyle = '#d5d7dc';
  ctx.fillRect(WORLD.left - 1600, top, WORLD.right - WORLD.left + 3200, 16);
  ctx.fillStyle = '#8d9199';
  ctx.fillRect(WORLD.left - 1600, top + 16, WORLD.right - WORLD.left + 3200, 140);
  // A row of arches cut into the balustrade, dark inside.
  ctx.fillStyle = '#2a2c32';
  for (let x = WORLD.left - 1600; x < WORLD.right + 1600; x += 92) {
    ctx.beginPath();
    ctx.moveTo(x + 14, top + 160);
    ctx.lineTo(x + 14, top + 52);
    ctx.arc(x + 46, top + 52, 32, Math.PI, 0);
    ctx.lineTo(x + 78, top + 160);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#e9eaee';
  ctx.fillRect(WORLD.left - 1600, top, WORLD.right - WORLD.left + 3200, 4);
  if (dim > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(20,6,12,${0.45 * dim})`;
    ctx.fillRect(0, view.height * 0.8, view.width, view.height * 0.2);
  }
}

function drawWindow(ctx, x, time) {
  const top = 40;
  const bottom = GROUND - 150;
  const w = 74;
  // The light falling in from the window.
  ctx.save();
  const shaft = ctx.createLinearGradient(x, top, x + 260, GROUND);
  shaft.addColorStop(0, 'rgba(255,255,255,0.22)');
  shaft.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, top + 30);
  ctx.lineTo(x + w / 2, top + 30);
  ctx.lineTo(x + w / 2 + 330, GROUND + 60);
  ctx.lineTo(x - w / 2 + 170, GROUND + 60);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#5d626c';
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 10, bottom + 10);
  ctx.lineTo(x - w / 2 - 10, top + w / 2);
  ctx.arc(x, top + w / 2, w / 2 + 10, Math.PI, 0);
  ctx.lineTo(x + w / 2 + 10, bottom + 10);
  ctx.closePath();
  ctx.fill();
  const pane = ctx.createLinearGradient(0, top, 0, bottom);
  pane.addColorStop(0, '#ffffff');
  pane.addColorStop(1, '#dfe3ea');
  ctx.fillStyle = pane;
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 30 + Math.sin(time * 1.3 + x) * 4;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, bottom);
  ctx.lineTo(x - w / 2, top + w / 2);
  ctx.arc(x, top + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w / 2, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(93,98,108,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, top + 4);
  ctx.lineTo(x, bottom);
  ctx.moveTo(x - w / 2, (top + bottom) / 2 + 20);
  ctx.lineTo(x + w / 2, (top + bottom) / 2 + 20);
  ctx.stroke();
}

/** A pillar, standing to `top`; a broken one stops at a jagged top. */
function drawPillar(ctx, x, top = -400) {
  const w = 70;
  const body = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  body.addColorStop(0, '#4a4e57');
  body.addColorStop(0.35, '#6f747e');
  body.addColorStop(0.7, '#555a63');
  body.addColorStop(1, '#3c4048');
  ctx.fillStyle = body;
  if (top <= -400) {
    ctx.fillRect(x - w / 2, -400, w, GROUND + 400);
  } else {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, GROUND);
    ctx.lineTo(x - w / 2, top + jag(x - 30) * 0.5);
    for (let u = -w / 2; u <= w / 2; u += 7) ctx.lineTo(x + u, top + jag(x + u * 3) * 0.6);
    ctx.lineTo(x + w / 2, GROUND);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#3a3e46';
  ctx.fillRect(x - w / 2 - 14, GROUND - 40, w + 28, 40);
  ctx.fillRect(x - w / 2 - 8, GROUND - 52, w + 16, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  const from = Math.max(-400, top + 20);
  for (let i = -1; i <= 1; i += 1) ctx.fillRect(x + i * 18 - 2, from, 4, Math.max(0, GROUND - 60 - from));
}
