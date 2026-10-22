/**
 * Shared building blocks for the tool layer.
 *
 * Every tool answers the same way: a short, readable summary in the text
 * content and the full data in `structuredContent`, so a client that shows
 * only text still gets a useful answer and a client that reads structure
 * gets the data without parsing prose.
 */
import { ToolError } from '../errors.js';

/** The project a call works on: the named one, or the active one. */
export function project(store, input) {
  return store.require(input?.project);
}

/**
 * The native keyframe index a request names.
 *
 * A keyframe number always means a position in the project's stored keyframe
 * list, which is what the figure, pose and timing tools address. The playback
 * timeline is a separate thing: an advanced project may expose fewer or more
 * ticks than it has keyframes.
 */
export function keyframeIndex(editor, input, { fallback = null } = {}) {
  if (input?.frame !== undefined && input?.frame !== null) {
    const index = Math.trunc(input.frame);
    if (!Number.isFinite(index) || index < 0 || index >= editor.report.keyframes.length) {
      throw new ToolError(
        `There is no keyframe ${index}. The project has ${editor.report.keyframes.length} keyframes (0 to ${editor.report.keyframes.length - 1}).`,
        { code: 'bad_frame' },
      );
    }
    return index;
  }
  if (input?.tick !== undefined && input?.tick !== null) {
    const tick = Math.trunc(input.tick);
    if (!Number.isFinite(tick) || tick < 0 || tick >= Math.max(1, editor.totalTicks)) {
      throw new ToolError(`Tick ${tick} is outside the animation (0 to ${Math.max(0, editor.totalTicks - 1)}).`, {
        code: 'bad_tick',
      });
    }
    const row = editor.timeline.find(entry => entry.start <= tick);
    return row ? row.index : 0;
  }
  if (fallback !== null) return fallback;
  return editor.frameIndex;
}

/** The playback tick a keyframe starts at. */
export function keyframeTick(editor, index) {
  const row = editor.timeline.find(entry => entry.index === index);
  if (row) return row.start;
  const fallback = editor.timeline[Math.min(index, editor.timeline.length - 1)];
  return fallback?.start ?? 0;
}

/** Move the playhead onto a keyframe. */
export function goToKeyframe(editor, index) {
  editor.seek(keyframeTick(editor, index));
  // A project with an advanced timeline can expose fewer playback rows than it
  // has keyframes. Point the editor at the named keyframe so an edit lands on
  // it rather than on whichever row the tick happened to fall in.
  if (editor.frameIndex !== index && index < editor.report.keyframes.length) {
    editor.frameIndex = index;
    editor.tick = keyframeTick(editor, index);
    editor._invalidate?.({ viewOnly: true });
  }
  return index;
}

/**
 * Select a figure instance and return its object.
 *
 * `uid` is the instance identity. `definitionId` picks a figure type when
 * the caller means the definition rather than an instance.
 */
export function selectObject(editor, uid, { required = true } = {}) {
  const frame = editor.selectionFrame ?? editor.frame;
  const object = frame.objects.find(entry => entry.unique_id === Number(uid));
  if (!object) {
    if (!required) return null;
    const present = frame.objects.map(entry => entry.unique_id);
    throw new ToolError(
      `No figure with the id ${uid} is in the current keyframe. Figures here: ${present.length ? present.join(', ') : 'none'}.`,
      { code: 'unknown_figure' },
    );
  }
  editor.select(object.unique_id);
  return object;
}

/** The segment index of a handle id, or null. */
export function segmentIndex(figure, handleId) {
  if (!figure) return null;
  const index = figure.segments.findIndex(segment => segment.segment_id === Number(handleId));
  return index < 0 ? null : index;
}

/** Select a joint by handle id (the native segment identity). */
export function selectJoint(editor, handleId) {
  const figure = editor.figure;
  const index = segmentIndex(figure, handleId);
  if (index === null) {
    const handles = figure?.segments?.map(segment => segment.segment_id) ?? [];
    throw new ToolError(
      `That figure has no joint with the handle id ${handleId}. Its handles: ${handles.join(', ') || 'none'}.`,
      { code: 'unknown_joint' },
    );
  }
  editor.select(editor.selectedUid, index);
  return index;
}

/** A number of degrees to radians. */
export const degrees = value => (value * Math.PI) / 180;

/** Turn `#rrggbb` or `[r,g,b]` into three RGB bytes. */
export function rgbBytes(color) {
  if (Array.isArray(color)) {
    if (color.length !== 3 || color.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
      throw new ToolError('An RGB colour needs three whole bytes between 0 and 255.', { code: 'bad_color' });
    }
    return [...color];
  }
  if (typeof color === 'string') {
    const hex = color.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
      throw new ToolError(`"${color}" is not a #rrggbb colour.`, { code: 'bad_color' });
    }
    const value = Number.parseInt(hex, 16);
    return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  }
  throw new ToolError('Give a colour as "#rrggbb" or as three RGB bytes.', { code: 'bad_color' });
}

/** The editor's transparency byte for an opacity between 0 and 1. */
export function transparencyByte(opacity) {
  if (typeof opacity !== 'number' || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new ToolError('Opacity must be a number between 0 and 1.', { code: 'bad_opacity' });
  }
  return Math.round((1 - opacity) * 255);
}

/** Build a tool result from data and a short human summary. */
export function result(summary, data) {
  return {
    content: [{ type: 'text', text: summary }],
    structuredContent: data,
  };
}

/** A one-line summary of the project's current state. */
export function projectLine(store, current) {
  const parts = [
    `${current.name}`,
    `${current.editor.report.keyframes.length} keyframes`,
    `${current.editor.report.fps} fps`,
    `${current.editor.report.canvas_width}×${current.editor.report.canvas_height}`,
  ];
  if (current.editor.dirty) parts.push('unsaved changes');
  return parts.join(' · ');
}

export { ToolError };
