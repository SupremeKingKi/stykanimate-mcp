/**
 * Recorded sound effects, layered into fight sounds.
 *
 * The fight asks for a sound by name (punch, heavy, clang, slash...). Each
 * name is built from layers: recorded samples from the Kenney.nl CC0 packs in
 * assets/sfx, and optionally some of the synthesised sound underneath for
 * weight. Every time a sound plays it picks one of the recorded variants and
 * nudges its pitch, so a run of punches never sounds like one sample on repeat.
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { decode } from './music.mjs';

const ROOT = 'fight/assets/sfx';
// How loud the built sounds play: enough to sit a few dB over a loud song.
const LEVEL = 1.8;

// Each layer is either recorded files (a folder and file-name prefix) or a
// synthesised sound by name, at a gain.
const RECIPES = {
  punch: [
    { files: ['impact-sounds', 'impactPunch_medium_'], gain: 1 },
    { synth: 'punch', gain: 0.3 },
  ],
  heavy: [
    { files: ['impact-sounds', 'impactPunch_heavy_'], gain: 0.8 },
    { files: ['sci-fi-sounds', 'explosionCrunch_'], gain: 0.35 },
    { synth: 'heavy', gain: 0.45 },
  ],
  block: [
    { files: ['impact-sounds', 'impactSoft_heavy_'], gain: 0.9 },
    { files: ['impact-sounds', 'impactPunch_medium_'], gain: 0.35 },
  ],
  clang: [
    { files: ['impact-sounds', 'impactMetal_heavy_'], gain: 1.2 },
    { files: ['sci-fi-sounds', 'impactMetal_'], gain: 0.5 },
  ],
  slash: [
    { files: ['rpg-audio', 'knifeSlice'], gain: 1.7 },
    { files: ['rpg-audio', 'chop'], gain: 0.9 },
    { synth: 'slash', gain: 0.45 },
  ],
  whoosh: [
    { synth: 'whoosh', gain: 0.7 },
    { files: ['rpg-audio', 'cloth'], gain: 0.55 },
  ],
  land: [
    { files: ['impact-sounds', 'impactSoft_heavy_'], gain: 0.8 },
    { files: ['impact-sounds', 'footstep_concrete_'], gain: 0.6 },
  ],
  step: [{ files: ['impact-sounds', 'footstep_concrete_'], gain: 0.8 }],
  boom: [
    { files: ['sci-fi-sounds', 'lowFrequency_explosion_'], gain: 1 },
    { synth: 'boom', gain: 0.4 },
  ],
  energyHit: [
    { files: ['sci-fi-sounds', 'forceField_'], gain: 0.6 },
    { files: ['impact-sounds', 'impactMetal_heavy_'], gain: 0.6 },
    { synth: 'energyHit', gain: 0.45 },
  ],
  draw: [{ files: ['rpg-audio', 'drawKnife'], gain: 1 }],
};

/** Stretch or squeeze a sound to shift its pitch, by linear resampling. */
function repitch(signal, ratio) {
  const out = new Float32Array(Math.floor(signal.length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const at = i * ratio;
    const j = Math.floor(at);
    out[i] = signal[j] + ((signal[j + 1] ?? 0) - signal[j]) * (at - j);
  }
  return out;
}

/** Load every recorded variant the recipes use, each scaled to the same peak. */
export async function loadSfx(rate) {
  const variants = new Map();
  for (const layers of Object.values(RECIPES)) {
    for (const layer of layers) {
      if (!layer.files) continue;
      const key = layer.files.join('/');
      if (variants.has(key)) continue;
      const [pack, prefix] = layer.files;
      const folder = path.join(ROOT, pack, 'Audio');
      let names;
      try {
        names = (await readdir(folder)).filter(name => name.startsWith(prefix) && name.endsWith('.ogg')).sort();
      } catch {
        names = [];
      }
      const sounds = [];
      for (const name of names) {
        const samples = await decode(path.join(folder, name), { rate });
        let peak = 0;
        for (const value of samples) peak = Math.max(peak, Math.abs(value));
        sounds.push(peak ? samples.map(value => (value / peak) * 0.9) : samples);
      }
      variants.set(key, sounds);
    }
  }
  return variants;
}

/**
 * Build one playing of a named sound: a random recorded variant per layer,
 * at a slightly random pitch, mixed with any synthesised layer. Returns null
 * for a name with no recipe or no recorded files, so the caller can fall back.
 */
export function voice(name, variants, synthBank, rand) {
  const recipe = RECIPES[name];
  if (!recipe) return null;
  const parts = [];
  let recorded = false;
  for (const layer of recipe) {
    if (layer.synth) {
      if (synthBank[layer.synth]) parts.push([synthBank[layer.synth], layer.gain]);
      continue;
    }
    const options = variants.get(layer.files.join('/')) ?? [];
    if (!options.length) continue;
    recorded = true;
    const pick = options[Math.floor(rand() * options.length)];
    parts.push([repitch(pick, 0.94 + rand() * 0.12), layer.gain]);
  }
  if (!recorded) return null;
  const length = Math.max(...parts.map(([signal]) => signal.length));
  const out = new Float32Array(length);
  for (const [signal, gain] of parts) for (let i = 0; i < signal.length; i += 1) out[i] += signal[i] * gain * LEVEL;
  return out;
}
