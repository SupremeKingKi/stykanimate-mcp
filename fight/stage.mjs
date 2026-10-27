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

export function drawStage(ctx, camera, view, { dim = 0, time = 0 } = {}) {
  const { width, height } = view;
  // Sky-free interior: the wall fills the frame.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const wall = ctx.createLinearGradient(0, 0, 0, height);
  wall.addColorStop(0, '#7f848e');
  wall.addColorStop(0.55, '#a7abb3');
  wall.addColorStop(1, '#b9bcc3');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, height);

  // Back wall: stone courses and tall arched windows with light shafts.
  layer(ctx, camera, 0.55, view);
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
  for (let x = WORLD.left - 400; x < WORLD.right + 600; x += 430) drawWindow(ctx, x, time);

  // Pillars in the middle distance.
  layer(ctx, camera, 0.8, view);
  for (let x = WORLD.left - 300; x < WORLD.right + 500; x += 640) drawPillar(ctx, x);

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
  if (dim > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(20,6,12,${0.55 * dim})`;
    ctx.fillRect(0, 0, width, height);
  }
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

function drawPillar(ctx, x) {
  const w = 70;
  const body = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  body.addColorStop(0, '#4a4e57');
  body.addColorStop(0.35, '#6f747e');
  body.addColorStop(0.7, '#555a63');
  body.addColorStop(1, '#3c4048');
  ctx.fillStyle = body;
  ctx.fillRect(x - w / 2, -400, w, GROUND + 400);
  ctx.fillStyle = '#3a3e46';
  ctx.fillRect(x - w / 2 - 14, GROUND - 40, w + 28, 40);
  ctx.fillRect(x - w / 2 - 8, GROUND - 52, w + 16, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = -1; i <= 1; i += 1) ctx.fillRect(x + i * 18 - 2, -400, 4, GROUND + 340);
}
