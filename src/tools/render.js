/**
 * Render tools: look at the animation.
 *
 * The other tools report the rig in numbers. These draw it, with the app's
 * own renderer, so a model can see whether a pose reads the way it meant:
 * one frame at a time, or a strip of frames across a whole move.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod/v4';
import { writeFileAtomic } from '../documents.js';
import { MAX_CELLS, MAX_SIDE, renderFrame, renderSheet } from '../render.js';
import { keyframeIndex, keyframeTick, project, ToolError } from './shared.js';

const projectField = z
  .string()
  .optional()
  .describe('The id of an open project, from project_open. Defaults to the project used most recently.');
const jointsField = z
  .boolean()
  .optional()
  .describe(
    'Mark every joint with its handle id, and every figure with its instance id, ' +
      'the numbers pose_set takes. Defaults to false.',
  );
const saveField = z
  .string()
  .optional()
  .describe('Also write the picture to this .png file. The picture is returned either way.');
const overwriteField = z
  .boolean()
  .optional()
  .describe('Replace the file at "savePath" if one is already there. Defaults to false.');
// Rendering only reads the project; the one thing it may write is a new
// picture file, and it never replaces an existing one unless asked to.
const renderAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true };

export function registerRenderTools(server, { store }) {
  server.registerTool(
    'render_frame',
    {
      title: 'Render a frame',
      description:
        'Draw one frame of the animation as a PNG picture, with the app\'s own renderer: the scene colour, the ' +
        'camera, every figure in paint order. Use it to see a pose after changing it, the way pose_evaluate ' +
        'reports it in numbers. Name a frame number, or a tick for an in-between; without either it draws the ' +
        'frame at the playhead. Turn on "showJoints" to label the joints you can pose. ' +
        'Rendering does not move the playhead.',
      inputSchema: z.object({
        project: projectField,
        frame: z.number().int().optional().describe('The place on the timeline to draw.'),
        tick: z.number().int().optional().describe('The absolute tick to draw. Overrides the frame number.'),
        width: z
          .number()
          .int()
          .min(64)
          .max(MAX_SIDE)
          .optional()
          .describe('The picture width in pixels. The height follows the canvas. Defaults to the canvas width, at most 960.'),
        showJoints: jointsField,
        transparent: z.boolean().optional().describe('Leave out the scene background. Defaults to false.'),
        savePath: saveField,
        overwrite: overwriteField,
      }),
      annotations: renderAnnotations,
    },
    async input => {
      const current = project(store, input);
      const editor = current.editor;
      const tick = tickFor(editor, input);
      const width = input.width ?? Math.min(editor.report.canvas_width, 960);
      const picture = await renderFrame(editor, tick, {
        width,
        background: !input.transparent,
        joints: Boolean(input.showJoints),
      });
      const saved = input.savePath ? await savePng(input.savePath, picture.png, input.overwrite) : null;
      const seconds = round(tick / (editor.report.fps || 1));
      return picturedResult(
        `Frame at tick ${tick} (${seconds}s), ${picture.width}×${picture.height}.` +
          (saved ? ` Saved to ${saved.path}.` : ''),
        picture.png,
        { tick, seconds, width: picture.width, height: picture.height, savedTo: saved?.path ?? null, project: current.id },
      );
    },
  );

  server.registerTool(
    'render_sheet',
    {
      title: 'Render a contact sheet',
      description:
        'Draw several frames side by side on one PNG, each captioned with its tick and time, to check a whole ' +
        'move at once: whether it reads, whether contact lands, whether the spacing is even. ' +
        'Choose the frames with "ticks", or with "frames" (frame numbers), or set "everyFrame" to draw the ' +
        'start of every frame on the timeline; otherwise it draws "count" ticks spread evenly from "fromTick" ' +
        `to "toTick". At most ${MAX_CELLS} frames. Rendering does not move the playhead.`,
      inputSchema: z.object({
        project: projectField,
        ticks: z.array(z.number().int()).optional().describe('The exact ticks to draw, in order.'),
        frames: z.array(z.number().int()).optional().describe('The frame numbers to draw, in order.'),
        everyFrame: z.boolean().optional().describe('Draw the first tick of every frame on the timeline.'),
        fromTick: z.number().int().optional().describe('The first tick of an even spread. Defaults to 0.'),
        toTick: z.number().int().optional().describe('The last tick of an even spread. Defaults to the last tick.'),
        count: z
          .number()
          .int()
          .min(1)
          .max(MAX_CELLS)
          .optional()
          .describe('How many ticks the even spread draws. Defaults to 12.'),
        columns: z.number().int().min(1).max(12).optional().describe('Frames per row. Defaults to 4.'),
        cellWidth: z
          .number()
          .int()
          .min(64)
          .max(960)
          .optional()
          .describe('The width of each frame in pixels. Defaults to 320.'),
        showJoints: jointsField,
        savePath: saveField,
        overwrite: overwriteField,
      }),
      annotations: renderAnnotations,
    },
    async input => {
      const current = project(store, input);
      const editor = current.editor;
      const ticks = sheetTicks(editor, input);
      const picture = await renderSheet(editor, ticks, {
        cellWidth: input.cellWidth ?? 320,
        columns: input.columns ?? 4,
        joints: Boolean(input.showJoints),
      });
      const saved = input.savePath ? await savePng(input.savePath, picture.png, input.overwrite) : null;
      return picturedResult(
        `${ticks.length} frames (ticks ${ticks.join(', ')}) in ${picture.rows} row(s) of ${picture.columns}, ` +
          `${picture.width}×${picture.height}.` +
          (saved ? ` Saved to ${saved.path}.` : ''),
        picture.png,
        {
          ticks,
          columns: picture.columns,
          rows: picture.rows,
          width: picture.width,
          height: picture.height,
          savedTo: saved?.path ?? null,
          project: current.id,
        },
      );
    },
  );
}

/** The tick a render_frame request names: a tick, a frame number, or the playhead. */
function tickFor(editor, input) {
  if (input.tick !== undefined) return checkTick(editor, input.tick);
  if (input.frame !== undefined) return keyframeTick(editor, keyframeIndex(editor, { frame: input.frame }));
  return editor.tick;
}

/** The ticks a render_sheet request names. */
function sheetTicks(editor, input) {
  let ticks;
  if (input.ticks?.length) {
    ticks = input.ticks.map(tick => checkTick(editor, tick));
  } else if (input.frames?.length) {
    ticks = input.frames.map(frame => keyframeTick(editor, keyframeIndex(editor, { frame })));
  } else if (input.everyFrame) {
    ticks = editor.timeline.map(row => row.start);
  } else {
    const last = Math.max(0, editor.totalTicks - 1);
    const from = checkTick(editor, input.fromTick ?? 0);
    const to = checkTick(editor, input.toTick ?? last);
    if (to < from) throw new ToolError(`"toTick" (${to}) comes before "fromTick" (${from}).`, { code: 'bad_tick' });
    const count = Math.min(input.count ?? 12, to - from + 1);
    ticks = Array.from({ length: count }, (_, index) =>
      count === 1 ? from : Math.round(from + ((to - from) * index) / (count - 1)),
    );
  }
  if (ticks.length > MAX_CELLS) {
    throw new ToolError(
      `That is ${ticks.length} frames; a contact sheet holds at most ${MAX_CELLS}. ` +
        'Ask for fewer, or split the range over several sheets.',
      { code: 'render_too_large' },
    );
  }
  return ticks;
}

function checkTick(editor, tick) {
  const last = Math.max(0, editor.totalTicks - 1);
  if (!Number.isInteger(tick) || tick < 0 || tick > last) {
    throw new ToolError(`Tick ${tick} is outside the animation (0 to ${last}).`, { code: 'bad_tick' });
  }
  return tick;
}

async function savePng(target, png, overwrite = false) {
  const destination = path.resolve(/\.png$/i.test(target) ? target : `${target}.png`);
  if (!overwrite && existsSync(destination)) {
    throw new ToolError(`${destination} already exists. Choose another path, or set "overwrite" to replace it.`, {
      code: 'file_exists',
    });
  }
  return writeFileAtomic(destination, png);
}

/** A tool result that carries a picture beside its summary and data. */
function picturedResult(summary, png, data) {
  return {
    content: [
      { type: 'text', text: summary },
      { type: 'image', data: png.toString('base64'), mimeType: 'image/png' },
    ],
    structuredContent: data,
  };
}

const round = value => Math.round(value * 1000) / 1000;
