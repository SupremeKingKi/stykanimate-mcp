#!/usr/bin/env node
/**
 * A real song as the soundtrack: decode it, and find its beat.
 *
 * analyze() finds the tempo, where the beats fall and which beat starts
 * each bar, and how loud each bar is, so a scene can pick a strong stretch
 * that starts on a bar and sync its blows to the song's own grid.
 *
 * Usage: node fight/music.mjs <song.mp3> [--seconds 13]
 *        (prints the tempo, the first beat, and the best stretch to use)
 */
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Decode part of a song to mono samples with ffmpeg. */
export function decode(file, { start = 0, duration = null, rate = 44100 } = {}) {
  const args = ['-v', 'error', '-ss', String(start)];
  if (duration) args.push('-t', String(duration));
  args.push('-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(rate), '-');
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.FFMPEG ?? 'ffmpeg', args, { stdio: ['ignore', 'pipe', 'inherit'] });
    const chunks = [];
    child.stdout.on('data', chunk => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`ffmpeg exited with ${code}`));
      const bytes = Buffer.concat(chunks);
      resolve(new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 4)));
    });
  });
}

/** An onset strength curve: how sharply the energy of a band rises, one value per hop. */
function onsets(samples, rate, hop, { low = null, high = null }) {
  // One-pole filters pick the band: kick drum (low) or snare and cymbals (high).
  const band = new Float32Array(samples.length);
  let lp = 0;
  const a = cutoff => 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  for (let i = 0; i < samples.length; i += 1) {
    lp += a(low ?? high) * (samples[i] - lp);
    band[i] = low ? lp : samples[i] - lp;
  }
  const frames = Math.floor(samples.length / hop);
  const curve = new Float32Array(frames);
  let previous = 0;
  for (let f = 0; f < frames; f += 1) {
    let energy = 0;
    for (let i = f * hop; i < (f + 1) * hop; i += 1) energy += band[i] * band[i];
    const level = Math.log1p(1000 * energy);
    curve[f] = Math.max(0, level - previous);
    previous = level;
  }
  return curve;
}

/**
 * Fold an onset curve over a period and see how sharply it peaks: a curve
 * folded over the true beat period piles its hits into one phase.
 */
function fold(curve, period, bins = 120) {
  const histogram = new Float64Array(bins);
  for (let f = 0; f < curve.length; f += 1) histogram[Math.floor(((f % period) / period) * bins) % bins] += curve[f];
  let best = 0;
  for (let b = 1; b < bins; b += 1) if (histogram[b] > histogram[best]) best = b;
  const mean = histogram.reduce((s, v) => s + v, 0) / bins;
  return { peak: histogram[best] / mean, phase: ((best + 0.5) / bins) * period };
}

/**
 * Find a song's tempo, beat phase, bar starts and bar loudness.
 * `near` is the tempo the song is listed at; the search stays within a few bpm of it.
 */
export async function analyze(file, { near = 150, rate = 22050, hop = 64 } = {}) {
  const samples = await decode(file, { rate });
  const kick = onsets(samples, rate, hop, { low: 150 });
  const snare = onsets(samples, rate, hop, { high: 2000 });
  const both = kick.map((v, i) => v + snare[i]);
  const hopSeconds = hop / rate;

  // Tempo: the period that folds the onsets into the sharpest peak.
  let best = null;
  for (let bpm = near - 3; bpm <= near + 3; bpm += 0.005) {
    const period = 60 / bpm / hopSeconds;
    const folded = fold(both, period);
    if (!best || folded.peak > best.peak) best = { bpm, ...folded };
  }
  const beat = 60 / best.bpm;
  const firstBeat = best.phase * hopSeconds;

  // Bars: of the four beats in a bar, the one with the most kick drum starts it.
  const barPeriod = (4 * beat) / hopSeconds;
  const kickByBeat = [0, 0, 0, 0];
  for (let f = 0; f < kick.length; f += 1) {
    const t = f * hopSeconds - firstBeat;
    const beatIndex = Math.round(t / beat);
    if (Math.abs(t - beatIndex * beat) < 0.03) kickByBeat[((beatIndex % 4) + 4) % 4] += kick[f];
  }
  const downbeat = kickByBeat.indexOf(Math.max(...kickByBeat));
  const firstBar = firstBeat + downbeat * beat;

  // Loudness of each bar, for picking a strong stretch.
  const bars = [];
  for (let start = firstBar; start + 4 * beat < samples.length / rate; start += 4 * beat) {
    let sum = 0;
    const from = Math.floor(start * rate);
    const to = Math.floor((start + 4 * beat) * rate);
    for (let i = from; i < to; i += 1) sum += samples[i] * samples[i];
    bars.push({ start, rms: Math.sqrt(sum / (to - from)) });
  }
  return { bpm: best.bpm, beat, firstBeat, firstBar, bar: 4 * beat, bars, confidence: best.peak, length: samples.length / rate, barPeriod };
}

/** The bar to start on so `seconds` of the song are as loud as possible throughout. */
export function bestStretch(analysis, seconds) {
  const count = Math.ceil(seconds / analysis.bar);
  let best = null;
  for (let i = 0; i + count <= analysis.bars.length; i += 1) {
    const window = analysis.bars.slice(i, i + count);
    // The quietest bar decides: a stretch with a lull in it scores low.
    const score = Math.min(...window.map(b => b.rms)) * 0.6 + (window.reduce((s, b) => s + b.rms, 0) / count) * 0.4;
    if (!best || score > best.score) best = { start: window[0].start, bar: i, score };
  }
  return best;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) throw new Error('Name a song file.');
  const at = process.argv.indexOf('--seconds');
  const seconds = at > 0 ? Number(process.argv[at + 1]) : 13;
  const analysis = await analyze(file);
  console.log(`${file}: ${analysis.length.toFixed(1)}s`);
  console.log(`  tempo ${analysis.bpm.toFixed(3)} bpm (a beat every ${(analysis.beat * 1000).toFixed(1)}ms), peak sharpness ${analysis.confidence.toFixed(2)}`);
  console.log(`  first beat at ${analysis.firstBeat.toFixed(3)}s, first bar start at ${analysis.firstBar.toFixed(3)}s`);
  const loudest = Math.max(...analysis.bars.map(b => b.rms));
  const line = analysis.bars.map(b => ' .:-=+*#%@'[Math.min(9, Math.round((b.rms / loudest) * 9))]).join('');
  console.log(`  loudness by bar: ${line}`);
  const stretch = bestStretch(analysis, seconds);
  console.log(`  best ${seconds}s stretch: starts at bar ${stretch.bar}, ${stretch.start.toFixed(3)}s into the song`);
}
