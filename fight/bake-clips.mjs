#!/usr/bin/env node
/**
 * Bake StykAnimate movieclips into sprite sheets the fight renderer can play.
 *
 * A library movieclip (.stykmov) carries a whole animation inside it. This
 * loads that inner animation into the StykAnimate engine, renders every
 * tick on a transparent background, trims the frames to what was drawn,
 * and writes one PNG strip plus a JSON note of the frame size, the clip's
 * pivot and its frame rate.
 *
 * Usage: node fight/bake-clips.mjs [clip.stykmov ...]
 *        (defaults to every clip in fight/assets/library)
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readDocument } from '../src/documents.js';
import { Editor } from '../src/core.js';
import { renderFrame } from '../src/render.js';
import { movieclipAsset } from '../vendor/stykanimate/src/movieclips.mjs';

const LIBRARY = 'fight/assets/library';
const OUT = 'fight/assets/sprites';

async function bake(file) {
  const loaded = await readDocument({ bytes: await readFile(file), filename: file });
  const clip = loaded.document.figure_types.find(type => movieclipAsset(type));
  if (!clip) throw new Error(`${file} holds no movieclip.`);
  const asset = movieclipAsset(clip);
  const editor = new Editor({ demo: false });
  editor.load(asset.document);
  const width = editor.report.canvas_width;
  const height = editor.report.canvas_height;

  const frames = [];
  for (let tick = 0; tick < asset.duration; tick += 1) {
    const { png } = await renderFrame(editor, tick, { width, background: false });
    frames.push(await loadImage(png));
  }

  // One box that holds what every frame drew, so the frames stay aligned.
  const box = { left: width, top: height, right: 0, bottom: 0 };
  for (const image of frames) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          box.left = Math.min(box.left, x);
          box.right = Math.max(box.right, x);
          box.top = Math.min(box.top, y);
          box.bottom = Math.max(box.bottom, y);
        }
      }
    }
  }
  const pad = 4;
  const left = Math.max(0, box.left - pad);
  const top = Math.max(0, box.top - pad);
  const w = Math.min(width, box.right + pad) - left;
  const h = Math.min(height, box.bottom + pad) - top;
  const strip = createCanvas(w * frames.length, h);
  const ctx = strip.getContext('2d');
  frames.forEach((image, i) => ctx.drawImage(image, left, top, w, h, i * w, 0, w, h));

  const name = path.basename(file, '.stykmov');
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, `${name}.png`), await strip.encode('png'));
  const meta = {
    name: clip.name ?? name,
    source: path.basename(file),
    frames: frames.length,
    width: w,
    height: h,
    fps: asset.document.fps,
    // Where the clip's pivot falls inside a trimmed frame.
    pivot: { x: asset.pivot.x - left, y: asset.pivot.y - top },
  };
  await writeFile(path.join(OUT, `${name}.json`), `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : (await readdir(LIBRARY)).filter(name => name.endsWith('.stykmov')).map(name => path.join(LIBRARY, name));
for (const file of files) {
  const meta = await bake(file);
  console.log(`${meta.source}: ${meta.frames} frames of ${meta.width}×${meta.height} at ${meta.fps} fps, pivot (${Math.round(meta.pivot.x)}, ${Math.round(meta.pivot.y)})`);
}
