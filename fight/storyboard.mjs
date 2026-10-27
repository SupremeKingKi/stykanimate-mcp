#!/usr/bin/env node
/**
 * Render a scene's storyboard: one captioned panel per beat of the story,
 * each drawn from the real frame at that moment.
 *
 * A scene lists its beats in `scene.storyboard` as { t, title, note }, with
 * t in scene seconds (after any beat sync).
 *
 * Usage: node fight/storyboard.mjs <scene.mjs> [--out fight/out/storyboard.png] [--columns 4]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { render } from './render.mjs';

/** Break text into lines that fit `width` pixels. */
function wrap(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function storyboard(scene, { out, columns = 4, cell = 400 }) {
  const beats = [...scene.storyboard].sort((a, b) => a.t - b.t);
  const { sheetFrames } = await render(scene, { fps: 30, width: 1280, height: 720, sheet: beats.map(beat => beat.t), audio: false });
  const cellH = Math.round((cell * 720) / 1280);
  const text = 74;
  const gap = 10;
  const rows = Math.ceil(beats.length / columns);
  const canvas = createCanvas(gap + columns * (cell + gap), gap + rows * (cellH + text + gap));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#16171c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const [i, beat] of beats.entries()) {
    const x = gap + (i % columns) * (cell + gap);
    const y = gap + Math.floor(i / columns) * (cellH + text + gap);
    const frame = sheetFrames[i];
    if (frame) ctx.drawImage(await loadImage(frame.png), x, y, cell, cellH);
    ctx.fillStyle = '#f3f3f7';
    ctx.font = 'bold 16px Bahnschrift';
    ctx.fillText(`${i + 1}. ${beat.title}`, x + 2, y + cellH + 20);
    ctx.fillStyle = '#a7aab5';
    ctx.font = '13px Bahnschrift';
    wrap(ctx, beat.note ?? '', cell - 4).slice(0, 3).forEach((line, n) => ctx.fillText(line, x + 2, y + cellH + 38 + n * 16));
  }
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, await canvas.encode('png'));
  return beats.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const file = args.find(arg => !arg.startsWith('--') && !/^\d+$/.test(arg) && !arg.endsWith('.png'));
  if (!file) throw new Error('Name a scene module.');
  const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const out = option('--out') ?? 'fight/out/storyboard.png';
  const { build } = await import(pathToFileURL(path.resolve(file)).href);
  const scene = build();
  if (!scene.storyboard?.length) throw new Error('The scene has no storyboard.');
  const count = await storyboard(scene, { out, columns: Number(option('--columns') ?? 4) });
  console.log(`Wrote ${out} (${count} panels).`);
}
