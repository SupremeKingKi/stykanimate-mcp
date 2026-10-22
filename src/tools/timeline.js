/**
 * Timeline tools: add, remove, move keyframes and change the timing of the
 * animation.
 */
import { z } from 'zod/v4';
import { ToolError } from '../errors.js';
import { goToKeyframe, keyframeIndex, project, result } from './shared.js';

const projectField = z
  .string()
  .optional()
  .describe('The id of an open project, from project_open. Defaults to the project used most recently.');
const frameField = z.number().int().optional().describe('The keyframe to work on. Defaults to the playhead.');

export function registerTimelineTools(server, { store }) {
  server.registerTool(
    'keyframe_edit',
    {
      title: 'Edit keyframes',
      description:
        'Change the shape of the timeline: add a keyframe, delete keyframes, duplicate them, or move one to a ' +
        'different position. A keyframe holds the pose of every figure at that moment, so adding one copies the ' +
        'current pose. Give "frames" to act on several keyframes at once.',
      inputSchema: z.object({
        project: projectField,
        action: z.enum(['add', 'delete', 'duplicate', 'move']).describe('The change to make.'),
        frame: frameField,
        frames: z.array(z.number().int()).optional().describe('The keyframes to act on.'),
        to: z.number().int().optional().describe('For "move": the keyframe number to move to.'),
        blank: z.boolean().optional().describe('For "add": add an empty keyframe with no figures.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async input => {
      const current = project(store, input);
      const editor = current.editor;
      const count = editor.report.keyframes.length;

      switch (input.action) {
        case 'add': {
          const index = keyframeIndex(editor, input);
          goToKeyframe(editor, index);
          editor.addFrame({ blank: Boolean(input.blank) });
          return result(
            `Added a keyframe after keyframe ${index}. The project now has ${editor.report.keyframes.length} keyframes.`,
            { addedAfter: index, keyframes: editor.report.keyframes.length, project: current.id },
          );
        }
        case 'delete': {
          const indices = input.frames ?? [keyframeIndex(editor, input)];
          for (const index of indices) {
            if (index < 0 || index >= count) throw new ToolError(`There is no keyframe ${index}.`, { code: 'bad_frame' });
          }
          editor.deleteFrames(indices);
          return result(
            `Deleted ${indices.length} keyframe(s). The project now has ${editor.report.keyframes.length} keyframes.`,
            { deleted: indices, keyframes: editor.report.keyframes.length, project: current.id },
          );
        }
        case 'duplicate': {
          const indices = input.frames ?? [keyframeIndex(editor, input)];
          for (const index of indices) {
            if (index < 0 || index >= count) throw new ToolError(`There is no keyframe ${index}.`, { code: 'bad_frame' });
          }
          editor.insertDuplicateFrames(indices);
          return result(
            `Duplicated ${indices.length} keyframe(s). The project now has ${editor.report.keyframes.length} keyframes.`,
            { duplicated: indices, keyframes: editor.report.keyframes.length, project: current.id },
          );
        }
        case 'move': {
          if (input.to === undefined) throw new ToolError('Give the keyframe number to move to.', { code: 'missing_value' });
          const from = keyframeIndex(editor, input);
          if (input.to < 0 || input.to >= count) {
            throw new ToolError(`There is no keyframe ${input.to} to move to.`, { code: 'bad_frame' });
          }
          editor.moveFrame(from, input.to);
          return result(`Moved keyframe ${from} to position ${input.to}.`, {
            from,
            to: input.to,
            keyframes: editor.report.keyframes.length,
            project: current.id,
          });
        }
        default:
          throw new ToolError(`Unknown action "${input.action}".`, { code: 'bad_action' });
      }
    },
  );

  server.registerTool(
    'keyframe_timing',
    {
      title: 'Change the timing',
      description:
        'Change how long the animation runs: the length of a keyframe, the frame rate of the whole project, or the ' +
        'size of the canvas. A keyframe length is in ticks; at 24 fps a length of 24 is one second.',
      inputSchema: z.object({
        project: projectField,
        action: z.enum(['duration', 'fps', 'canvas']).describe('What to change.'),
        frame: frameField,
        frames: z.array(z.number().int()).optional().describe('The keyframes whose length to change.'),
        ticks: z.number().int().min(0).max(65535).optional().describe('For "duration": the new keyframe length.'),
        fps: z.number().int().min(1).max(1000).optional().describe('For "fps": the new frame rate.'),
        width: z.number().int().min(1).max(100000).optional().describe('For "canvas": the new width in pixels.'),
        height: z.number().int().min(1).max(100000).optional().describe('For "canvas": the new height in pixels.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async input => {
      const current = project(store, input);
      const editor = current.editor;
      switch (input.action) {
        case 'duration': {
          if (input.ticks === undefined) throw new ToolError('Give the new keyframe length in ticks.', { code: 'missing_value' });
          const indices = input.frames ?? [keyframeIndex(editor, input)];
          for (const index of indices) {
            if (index < 0 || index >= editor.report.keyframes.length) {
              throw new ToolError(`There is no keyframe ${index}.`, { code: 'bad_frame' });
            }
          }
          editor.setFramesDuration(indices, input.ticks);
          return result(`Set ${indices.length} keyframe(s) to ${input.ticks} ticks.`, {
            frames: indices,
            ticks: input.ticks,
            totalTicks: editor.totalTicks,
            project: current.id,
          });
        }
        case 'fps': {
          if (input.fps === undefined) throw new ToolError('Give the new frame rate.', { code: 'missing_value' });
          editor.setFPS(input.fps);
          return result(`Set the frame rate to ${input.fps} fps.`, { fps: input.fps, project: current.id });
        }
        case 'canvas': {
          if (input.width === undefined || input.height === undefined) {
            throw new ToolError('Give both a width and a height for the canvas.', { code: 'missing_value' });
          }
          editor.setCanvasSize(input.width, input.height);
          return result(`Resized the canvas to ${input.width}×${input.height}.`, {
            width: input.width,
            height: input.height,
            project: current.id,
          });
        }
        default:
          throw new ToolError(`Unknown action "${input.action}".`, { code: 'bad_action' });
      }
    },
  );
}
