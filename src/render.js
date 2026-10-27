/**
 * Pictures of an animation.
 *
 * The app draws a frame with its own canvas renderer. Here the same code
 * draws onto a Node canvas, so a picture shows what the app would show at
 * that tick: the scene colour, the camera, every figure in paint order.
 *
 * The canvas comes from @napi-rs/canvas, an optional dependency. Without it
 * the server still reads and edits projects, and the render tools say how to
 * add it.
 */
import { ToolError } from './errors.js';
import { drawGeometry } from '../vendor/stykanimate/src/pivot/geometry.mjs';
import { drawBackground } from '../vendor/stykanimate/src/pivot/background.mjs';
import { cameraMatrix } from '../vendor/stykanimate/src/renderer-geometry.mjs';

/** The largest picture any render makes, on either side, in pixels. */
export const MAX_SIDE = 2048;
/** The most frames one contact sheet holds. */
export const MAX_CELLS = 36;

let library = null;

/** The canvas library, loaded on first use. */
async function canvasLibrary() {
  if (library) return library;
  try {
    library = await import('@napi-rs/canvas');
  } catch {
    throw new ToolError(
      'Rendering needs the optional package @napi-rs/canvas, which is not installed. ' +
        "Run `npm install @napi-rs/canvas` in the server's folder, then restart the server.",
      { code: 'render_unavailable' },
    );
  }
  // The renderer paints translucent figures and outlines on scratch surfaces
  // it makes with OffscreenCanvas, which Node does not have.
  globalThis.OffscreenCanvas ??= class {
    constructor(width, height) {
      return library.createCanvas(width, height);
    }
  };
  // Effects with filters (glows, blurs) hand pixels back through ImageData.
  globalThis.ImageData ??= library.ImageData;
  return library;
}

/** Whether this installation can render pictures. */
export async function canRender() {
  try {
    await canvasLibrary();
    return true;
  } catch {
    return false;
  }
}

/**
 * Seek to each tick in turn and hand the frame to `paint`, then put the
 * playhead back where it was, so a picture never moves the frame the other
 * tools default to.
 */
function atTicks(editor, ticks, paint) {
  const before = editor.tick;
  try {
    ticks.forEach((tick, index) => paint(editor.seek(tick), tick, index));
  } finally {
    editor.seek(before);
  }
}

/**
 * Paint the frame the editor is on into a rectangle of the context.
 *
 * `view` places the canvas: its top-left corner at (x, y) and every canvas
 * pixel `scale` pixels wide. The rectangle is clipped, so a camera that looks
 * beyond the canvas never paints into a neighbouring cell.
 */
function paintFrame(ctx, editor, frame, view, { background, joints }) {
  const report = editor.report;
  const width = report.canvas_width;
  const height = report.canvas_height;
  ctx.save();
  ctx.beginPath();
  ctx.rect(view.x, view.y, width * view.scale, height * view.scale);
  ctx.clip();
  ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
  if (background) drawBackground(ctx, report, frame, width, height);
  const matrix = cameraMatrix({ report, frame, view });
  ctx.setTransform(...matrix);
  drawGeometry(ctx, editor.geometry, {});
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (joints) paintJoints(ctx, editor, frame, matrix);
  ctx.restore();
}

/**
 * Mark every joint with a dot and its handle id, and every figure's root
 * with its instance id: the two numbers `pose_set` takes.
 */
function paintJoints(ctx, editor, frame, [a, b, c, d, e, f]) {
  const toScreen = point => [a * point.x + c * point.y + e, b * point.x + d * point.y + f];
  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const object of frame.objects) {
    const solved = editor.geometry.objects.get(object.object_slot);
    if (!solved) continue;
    for (const [handleId, joint] of solved.joints) {
      const [x, y] = toScreen(joint);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = handleId === 0 ? '#e5484d' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#1c2233';
      ctx.stroke();
      label(ctx, String(handleId), x + 6, y - 7, '#1c2233');
    }
    if (solved.root) {
      const [x, y] = toScreen(solved.root);
      label(ctx, `uid ${object.unique_id}`, x + 6, y + 9, '#e5484d');
    }
  }
}

/** Text with a pale halo, readable on any figure or background. */
function label(ctx, text, x, y, color) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function checkSize(width, height) {
  if (width > MAX_SIDE || height > MAX_SIDE) {
    throw new ToolError(
      `That picture would be ${width}×${height} pixels; the largest allowed is ${MAX_SIDE} on either side. ` +
        'Ask for a smaller width.',
      { code: 'render_too_large' },
    );
  }
}

/**
 * One frame as a PNG.
 *
 * @returns {Promise<{png: Buffer, width: number, height: number}>}
 */
export async function renderFrame(editor, tick, { width, background = true, joints = false } = {}) {
  const { createCanvas } = await canvasLibrary();
  const report = editor.report;
  const scale = width / report.canvas_width;
  const outWidth = Math.round(width);
  const outHeight = Math.round(report.canvas_height * scale);
  checkSize(outWidth, outHeight);
  const canvas = createCanvas(outWidth, outHeight);
  const ctx = canvas.getContext('2d');
  atTicks(editor, [tick], frame => paintFrame(ctx, editor, frame, { scale, x: 0, y: 0 }, { background, joints }));
  return { png: canvas.toBuffer('image/png'), width: outWidth, height: outHeight };
}

const GAP = 8;
const CAPTION = 22;

/**
 * Several frames side by side on one PNG, each captioned with its tick and
 * time, so a whole move can be read at a glance.
 *
 * @returns {Promise<{png: Buffer, width: number, height: number, columns: number, rows: number}>}
 */
export async function renderSheet(editor, ticks, { cellWidth, columns, joints = false } = {}) {
  if (!ticks.length) throw new ToolError('A contact sheet needs at least one tick.', { code: 'missing_value' });
  if (ticks.length > MAX_CELLS) {
    throw new ToolError(`A contact sheet holds at most ${MAX_CELLS} frames; ${ticks.length} were asked for.`, {
      code: 'render_too_large',
    });
  }
  const { createCanvas } = await canvasLibrary();
  const report = editor.report;
  const fps = report.fps || 1;
  const scale = cellWidth / report.canvas_width;
  const cellHeight = Math.round(report.canvas_height * scale);
  const cols = Math.max(1, Math.min(columns, ticks.length));
  const rows = Math.ceil(ticks.length / cols);
  const width = Math.round(GAP + cols * (cellWidth + GAP));
  const height = Math.round(GAP + rows * (cellHeight + CAPTION + GAP));
  checkSize(width, height);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e4e6ec';
  ctx.fillRect(0, 0, width, height);
  atTicks(editor, ticks, (frame, tick, index) => {
    const x = GAP + (index % cols) * (cellWidth + GAP);
    const y = GAP + Math.floor(index / cols) * (cellHeight + CAPTION + GAP);
    paintFrame(ctx, editor, frame, { scale, x, y }, { background: true, joints });
    ctx.font = '13px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1c2233';
    ctx.fillText(`#${index + 1}  tick ${tick}  ·  ${(tick / fps).toFixed(2)}s`, x + 2, y + cellHeight + CAPTION / 2);
  });
  return { png: canvas.toBuffer('image/png'), width, height, columns: cols, rows };
}
