#!/usr/bin/env node
/**
 * Report whether blows connect: for every impact in a scene, the gap between
 * the striking fist, foot or blade and the body it hits, before and after
 * the lunges contacts.mjs adds.
 *
 * Usage: node fight/check-contacts.mjs <scene.mjs> [--all]
 *        (lists the impacts that still miss; --all lists every one)
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { connect } from './contacts.mjs';

const file = process.argv[2];
if (!file) throw new Error('Name a scene module.');
const { build } = await import(pathToFileURL(path.resolve(file)).href);
const scene = build();
const report = scene.contacts ?? connect(scene);
const all = process.argv.includes('--all');
let misses = 0;
for (const { before, after, moved } of report) {
  const missed = after.gap > 10;
  if (missed) misses += 1;
  if (missed || all) {
    console.log(`${after.t.toFixed(2)}s  ${after.by}'s ${after.part} → ${after.target}: ${before.gap}px → ${after.gap}px` + `${moved ? ` (lunged ${moved}px)` : ''}${missed ? '  STILL MISSES' : ''}  [${after.kind}]`);
  }
}
console.log(`${report.length} impacts checked, ${misses} still more than 10px from the body they hit.`);
