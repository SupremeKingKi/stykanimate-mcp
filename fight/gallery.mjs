#!/usr/bin/env node
/**
 * Draw every named pose on one sheet, to check the pose library by eye.
 *
 * Usage: node fight/gallery.mjs [out.png] [character]
 */
import { writeFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';
import { Actor } from './characters.mjs';
import { POSES } from './poses.mjs';
import { lowestPoint } from './rig.mjs';

const out = process.argv[2] ?? 'fight/out/gallery.png';
const who = process.argv[3] ?? 'kade';
const names = Object.keys(POSES);
const cell = 170;
const columns = 8;
const rows = Math.ceil(names.length / columns);
const canvas = createCanvas(columns * cell, rows * (cell + 20));
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#c9ccd3';
ctx.fillRect(0, 0, canvas.width, canvas.height);

names.forEach((name, index) => {
  const actor = new Actor(who);
  const x = (index % columns) * cell + cell / 2;
  const ground = Math.floor(index / columns) * (cell + 20) + cell - 10;
  const state = { pose: POSES[name], x, y: 0, facing: 1, vx: 0, weapon: true };
  actor.update(state, 1 / 30);
  state.y = ground - lowestPoint(actor.solved);
  for (let i = 0; i < 20; i += 1) actor.update(state, 1 / 30);
  ctx.strokeStyle = '#9aa0ab';
  ctx.beginPath();
  ctx.moveTo(x - cell / 2 + 6, ground);
  ctx.lineTo(x + cell / 2 - 6, ground);
  ctx.stroke();
  ctx.save();
  const scale = actor.look.scale > 1.2 ? 0.75 : 1;
  ctx.translate(x, ground);
  ctx.scale(scale, scale);
  ctx.translate(-x, -ground);
  actor.draw(ctx);
  ctx.restore();
  ctx.fillStyle = '#1c2233';
  ctx.font = '13px Arial';
  ctx.fillText(name, x - cell / 2 + 6, ground + 16);
});

await writeFile(out, canvas.toBuffer('image/png'));
console.log(`Wrote ${out}`);
