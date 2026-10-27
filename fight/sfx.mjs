/**
 * Recorded sound effects, layered into fight sounds.
 *
 * The fight asks for a sound by name (punch, heavy, clang, slash...). Each
 * name is built from layers: recorded samples from the packs in assets/sfx
 * (see CREDITS.md there), and optionally some of the synthesised sound
 * underneath for weight. A layer draws from a pool of recordings, which can
 * span several packs, and every time a sound plays it picks one at random and
 * nudges its pitch, so a run of punches never sounds like one sample on repeat.
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { decode } from './music.mjs';

const ROOT = 'fight/assets/sfx';
// How loud the built sounds play: enough to sit a few dB over a loud song.
const LEVEL = 1.8;
const AUDIO = /\.(ogg|wav|flac)$/i;

// Each layer is either recordings or a synthesised sound by name, at a gain.
// `files` is a folder (searched all the way down) and a file-name prefix, or a
// list of such pairs pooled together. `max` trims long recordings, in seconds.
const RECIPES = {
  punch: [
    { files: [['impact-sounds', 'impactPunch_medium_'], ['oga/hits-and-punches', 'hit']], gain: 1 },
    { synth: 'punch', gain: 0.3 },
  ],
  heavy: [
    { files: [['impact-sounds', 'impactPunch_heavy_'], ['oga/breaking-and-falling', 'bfh1_hit']], gain: 0.8, max: 1.2 },
    { files: ['sci-fi-sounds', 'explosionCrunch_'], gain: 0.35 },
    { synth: 'heavy', gain: 0.45 },
  ],
  block: [
    { files: ['impact-sounds', 'impactSoft_heavy_'], gain: 0.9 },
    { files: [['impact-sounds', 'impactPunch_medium_'], ['oga/hits-and-punches', 'hit']], gain: 0.35 },
  ],
  clang: [
    { files: [['impact-sounds', 'impactMetal_heavy_'], ['oga/rpg-sfx', 'metal'], ['oga/breaking-and-falling', 'bfh1_metal_hit']], gain: 1.5, max: 1.2 },
    { files: ['sci-fi-sounds', 'impactMetal_'], gain: 0.5 },
  ],
  slash: [
    { files: [['rpg-audio', 'knifeSlice'], ['oga/rpg-sfx', 'blade'], ['oga/melee-sounds', 'sword sound']], gain: 1.6 },
    { files: ['rpg-audio', 'chop'], gain: 0.7 },
    { synth: 'slash', gain: 0.4 },
  ],
  whoosh: [
    { files: ['oga/swishes', 'swish'], gain: 1 },
    { synth: 'whoosh', gain: 0.35 },
  ],
  land: [
    { files: [['impact-sounds', 'impactSoft_heavy_'], ['oga/breaking-and-falling', 'bfh1_falling']], gain: 0.8, max: 1 },
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
  // A real roar over the old synthesised rumble.
  roar: [
    { files: [['oga/creature-sfx', 'roar_'], ['oga/creature-sfx-2', 'roar_'], ['oga/rpg-sfx', 'creature_roar']], gain: 1.3 },
    { synth: 'roar', gain: 0.35 },
  ],
  growl: [{ files: [['oga/creature-sfx', 'monster_'], ['oga/creature-sfx-2', 'monster_'], ['oga/rpg-sfx', 'creature_monster']], gain: 1.1, max: 1.5 }],
  ice: [
    { files: ['oga/ice-electricity-magic', 'qubodupIceDamage'], gain: 1, max: 1.2 },
    { files: ['impact-sounds', 'impactGlass_light_'], gain: 0.4 },
  ],
  freeze: [{ files: ['oga/freeze-spell', 'freeze'], gain: 1, max: 2.5 }],
  shatter: [
    { files: ['oga/ice-shatters', 'LedasLuzta'], gain: 1.3 },
    { files: ['impact-sounds', 'impactGlass_heavy_'], gain: 0.6 },
    { synth: 'boom', gain: 0.3 },
  ],
  // A real close strike, cut before its rain runs on.
  thunder: [
    { files: ['oga/thunder-very-close', 'Thunder'], gain: 1.3, max: 2.5 },
    { files: ['sci-fi-sounds', 'explosionCrunch_'], gain: 0.4 },
  ],
  // A death cry: creature death sounds slowed right down.
  die: [
    { files: [['oga/creature-sfx-2', 'die_'], ['oga/rpg-sfx', 'creature_die']], gain: 1.4, pitch: 0.62 },
    { files: [['oga/creature-sfx', 'roar_'], ['oga/creature-sfx-2', 'roar_']], gain: 0.7, pitch: 0.55 },
    { synth: 'roar', gain: 0.25 },
  ],
  // The ice and the demon breaking at once.
  bigShatter: [
    { files: ['oga/ice-shatters', 'LedasLuzta'], gain: 1.4 },
    { files: ['oga/ice-shatters', 'LedasLuzta'], gain: 1, pitch: 0.7 },
    { files: ['oga/breaking-and-falling', 'bfh1_glass_breaking'], gain: 0.8 },
    { synth: 'boom', gain: 0.6 },
  ],
  bodyFall: [
    { files: [['oga/breaking-and-falling', 'bfh1_falling'], ['impact-sounds', 'impactSoft_heavy_']], gain: 1.1, pitch: 0.8, max: 1.2 },
    { synth: 'boom', gain: 0.35 },
  ],
  heartbeat: [{ synth: 'heartbeat', gain: 1 }],
  suck: [{ synth: 'suck', gain: 1 }],
  ring: [{ synth: 'ring', gain: 1 }],
  zap: [
    { files: ['oga/ice-electricity-magic', 'qubodupElectricityDamage'], gain: 1, max: 1.2 },
    { files: ['sci-fi-sounds', 'laserLarge_'], gain: 0.4 },
  ],
};

/** A layer's recording pool, as a list of [folder, prefix] pairs. */
const pools = files => (Array.isArray(files[0]) ? files : [files]);
const poolKey = files => JSON.stringify(pools(files));

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

/** Cut a sound to `max` seconds, fading out the last fifth of a second. */
function trim(signal, max, rate) {
  const length = Math.min(signal.length, Math.round(max * rate));
  const out = signal.slice(0, length);
  const fade = Math.min(length, Math.round(0.2 * rate));
  for (let i = 0; i < fade; i += 1) out[length - 1 - i] *= i / fade;
  return out;
}

/** Load every recorded variant the recipes use, each scaled to the same peak. */
export async function loadSfx(rate) {
  const variants = new Map();
  const listings = new Map();
  for (const layers of Object.values(RECIPES)) {
    for (const layer of layers) {
      if (!layer.files) continue;
      const key = poolKey(layer.files);
      if (variants.has(key)) continue;
      const sounds = [];
      for (const [pack, prefix] of pools(layer.files)) {
        const folder = path.join(ROOT, pack);
        if (!listings.has(folder)) {
          try {
            listings.set(folder, (await readdir(folder, { recursive: true })).filter(name => AUDIO.test(name)));
          } catch {
            listings.set(folder, []);
          }
        }
        const names = listings.get(folder).filter(name => path.basename(name).startsWith(prefix)).sort();
        for (const name of names) {
          let samples = await decode(path.join(folder, name), { rate });
          if (layer.max) samples = trim(samples, layer.max, rate);
          let peak = 0;
          for (const value of samples) peak = Math.max(peak, Math.abs(value));
          sounds.push(peak ? samples.map(value => (value / peak) * 0.9) : samples);
        }
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
    const options = variants.get(poolKey(layer.files)) ?? [];
    if (!options.length) continue;
    recorded = true;
    const pick = options[Math.floor(rand() * options.length)];
    // A layer's pitch below 1 plays it slower and deeper.
    parts.push([repitch(pick, (layer.pitch ?? 1) * (0.94 + rand() * 0.12)), layer.gain]);
  }
  if (!recorded) return null;
  const length = Math.max(...parts.map(([signal]) => signal.length));
  const out = new Float32Array(length);
  for (const [signal, gain] of parts) for (let i = 0; i < signal.length; i += 1) out[i] += signal[i] * gain * LEVEL;
  return out;
}
