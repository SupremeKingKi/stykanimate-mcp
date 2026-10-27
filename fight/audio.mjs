/**
 * Sound. Effects are built in sfx.mjs from recorded CC0 samples layered over
 * sounds synthesised here from noise and oscillators; without the samples the
 * synthesised ones play alone. The bed is either a song the scene names or a
 * synthesised score: a drone with a drum and bass pulse whose intensity the
 * scene sets.
 */
import { writeFile } from 'node:fs/promises';
import { random } from './effects.mjs';
import { decode } from './music.mjs';
import { loadSfx, voice } from './sfx.mjs';

const RATE = 44100;

/** One-pole filters, enough to shape noise into thumps and swishes. */
function lowpass(signal, cutoff) {
  const out = new Float32Array(signal.length);
  let y = 0;
  for (let i = 0; i < signal.length; i += 1) {
    const c = typeof cutoff === 'function' ? cutoff(i / RATE) : cutoff;
    const a = 1 - Math.exp((-2 * Math.PI * c) / RATE);
    y += a * (signal[i] - y);
    out[i] = y;
  }
  return out;
}

function highpass(signal, cutoff) {
  const low = lowpass(signal, cutoff);
  return signal.map((value, i) => value - low[i]);
}

function noise(seconds, rand) {
  return Float32Array.from({ length: Math.round(seconds * RATE) }, () => rand() * 2 - 1);
}

function envelope(signal, attack, decay) {
  return signal.map((value, i) => {
    const t = i / RATE;
    return value * (t < attack ? t / attack : Math.exp(-(t - attack) / decay));
  });
}

/** A sine whose pitch glides from f0 to f1. */
function sweep(seconds, f0, f1, curve = 8) {
  const out = new Float32Array(Math.round(seconds * RATE));
  let phase = 0;
  for (let i = 0; i < out.length; i += 1) {
    const t = i / RATE;
    const f = f1 + (f0 - f1) * Math.exp(-t * curve);
    phase += (2 * Math.PI * f) / RATE;
    out[i] = Math.sin(phase);
  }
  return out;
}

function add(...parts) {
  const length = Math.max(...parts.map(([signal]) => signal.length));
  const out = new Float32Array(length);
  for (const [signal, gain] of parts) for (let i = 0; i < signal.length; i += 1) out[i] += signal[i] * gain;
  return out;
}

const soft = signal => signal.map(value => Math.tanh(value * 1.6) / Math.tanh(1.6));

function makeSounds(rand) {
  const punch = soft(add(
    [envelope(sweep(0.25, 160, 50, 30), 0.002, 0.07), 1],
    [envelope(lowpass(noise(0.12, rand), 2400), 0.001, 0.025), 0.7],
  ));
  const heavy = soft(add(
    [envelope(sweep(0.7, 110, 32, 9), 0.003, 0.22), 1.3],
    [envelope(lowpass(noise(0.4, rand), 1400), 0.001, 0.09), 0.9],
    [envelope(highpass(noise(0.1, rand), 3000), 0.001, 0.02), 0.35],
  ));
  const block = soft(add(
    [envelope(sweep(0.15, 260, 120, 25), 0.001, 0.04), 0.8],
    [envelope(highpass(noise(0.08, rand), 1800), 0.001, 0.015), 0.5],
  ));
  const partials = [523, 1187, 1873, 2791, 3517];
  const metal = new Float32Array(Math.round(0.9 * RATE));
  for (const [n, f] of partials.entries()) {
    for (let i = 0; i < metal.length; i += 1) metal[i] += (Math.sin((2 * Math.PI * f * i) / RATE) * Math.exp((-i / RATE) * (4 + n * 2))) / (n + 1.4);
  }
  const clang = add([metal, 0.9], [envelope(highpass(noise(0.06, rand), 2500), 0.001, 0.01), 0.6]);
  const slash = envelope(highpass(lowpass(noise(0.3, rand), t => 9000 - t * 20000), 1500), 0.01, 0.06);
  const whoosh = envelope(lowpass(highpass(noise(0.35, rand), 300), t => 600 + Math.sin(Math.min(1, t / 0.3) * Math.PI) * 2600), 0.12, 0.08);
  const energy = new Float32Array(Math.round(0.45 * RATE));
  let phase = 0;
  for (let i = 0; i < energy.length; i += 1) {
    const t = i / RATE;
    phase += (2 * Math.PI * (220 + t * 1500 + Math.sin(t * 60) * 30)) / RATE;
    energy[i] = (Math.sin(phase) * 0.5 + Math.sin(phase * 2.01) * 0.25) * Math.min(1, t / 0.03) * Math.exp(-t / 0.25);
  }
  const energyHit = soft(add([heavy, 0.8], [envelope(metal, 0.001, 0.25), 0.4], [energy, 0.3]));
  const roarLen = Math.round(1.4 * RATE);
  const roar = new Float32Array(roarLen);
  const growl = lowpass(noise(1.4, rand), 900);
  phase = 0;
  for (let i = 0; i < roarLen; i += 1) {
    const t = i / RATE;
    phase += (2 * Math.PI * (68 + Math.sin(t * 7) * 6)) / RATE;
    const saw = ((phase / (2 * Math.PI)) % 1) * 2 - 1;
    const env = Math.min(1, t / 0.15) * Math.min(1, (1.4 - t) / 0.4);
    roar[i] = (saw * 0.5 + growl[i] * 2.2) * env * (0.75 + 0.25 * Math.sin(t * 38));
  }
  const powerLen = Math.round(2 * RATE);
  const powerUp = new Float32Array(powerLen);
  phase = 0;
  const hiss = highpass(noise(2, rand), 2000);
  for (let i = 0; i < powerLen; i += 1) {
    const t = i / RATE;
    phase += (2 * Math.PI * (55 + t * t * 40)) / RATE;
    powerUp[i] = (Math.sin(phase) * 0.6 + Math.sin(phase * 1.5) * 0.3 + hiss[i] * 0.15 * t) * Math.min(1, t / 0.4) * Math.min(1, (2 - t) / 0.1);
  }
  const land = soft(add([envelope(sweep(0.3, 90, 40, 14), 0.002, 0.08), 0.9], [envelope(lowpass(noise(0.2, rand), 800), 0.002, 0.05), 0.8]));
  const step = envelope(lowpass(noise(0.08, rand), 500), 0.002, 0.02);
  // A cinematic "braam": detuned low brass made of saws, its filter opening on the hit.
  const braamLen = Math.round(3 * RATE);
  const braam = new Float32Array(braamLen);
  const voices = [55, 55.35, 82.4, 110.2, 41.2].map(f => ({ f, phase: 0 }));
  let filtered = 0;
  for (let i = 0; i < braamLen; i += 1) {
    const t = i / RATE;
    let sum = 0;
    for (const voice of voices) {
      voice.phase += voice.f / RATE;
      sum += ((voice.phase % 1) * 2 - 1) * (voice.f < 50 ? 0.4 : 0.3);
    }
    const cutoff = 180 + 1700 * Math.min(1, t / 0.25) * Math.exp(-t / 1.2);
    filtered += (1 - Math.exp((-2 * Math.PI * cutoff) / RATE)) * (sum - filtered);
    braam[i] = filtered * Math.min(1, t / 0.02) * Math.exp(-t / 1.1);
  }
  // A riser: noise and a tone climbing for a second and a half, cut off dead.
  const riserLen = Math.round(1.6 * RATE);
  const riser = new Float32Array(riserLen);
  const riserNoise = highpass(noise(1.6, rand), 1200);
  phase = 0;
  for (let i = 0; i < riserLen; i += 1) {
    const t = i / RATE;
    phase += (2 * Math.PI * (180 + (t / 1.6) ** 2 * 1700)) / RATE;
    riser[i] = (Math.sin(phase) * 0.35 + riserNoise[i] * 0.5) * (t / 1.6) ** 2;
  }
  // A sub drop that you feel more than hear.
  const boom = soft(add([envelope(sweep(2, 95, 26, 2.2), 0.004, 0.7), 1.4], [envelope(lowpass(noise(0.6, rand), 600), 0.002, 0.15), 0.8]));
  return { punch, heavy, block, clang, slash, whoosh, energy, energyHit, roar: soft(roar), powerUp, land, step, braam: soft(braam), riser, boom, draw: slash };
}

/**
 * The eighth-note grid the drums play on. Normally it keeps a steady tempo
 * but re-phases whenever a blow lands near a grid step, so that step falls
 * exactly on the blow: the music follows the fight. A locked score (a fight
 * synced to the beat) never re-phases; it only marks the steps blows land on.
 */
function grid(duration, step, hits, locked = false) {
  const times = [];
  const snapped = new Set();
  let t = 0;
  let next = 0;
  while (t < duration) {
    while (next < hits.length && hits[next] < t - step / 2) next += 1;
    if (locked) {
      if (next < hits.length && Math.abs(hits[next] - t) <= 0.035) snapped.add(times.length);
    } else if (next < hits.length && Math.abs(hits[next] - t) <= step / 2) {
      t = hits[next];
      snapped.add(times.length);
      next += 1;
    }
    times.push(t);
    t += step;
  }
  return { times, snapped };
}

/** The score: a low drone, and drums and bass that follow the scene's intensity and its blows. */
function score(duration, music, rand, hits = []) {
  const length = Math.round(duration * RATE);
  const out = new Float32Array(length);
  if (!music) return out;
  const bpm = music.bpm ?? 140;
  const beat = 60 / bpm;
  const intensity = t => {
    let value = 0;
    for (const part of music.sections) if (t >= part.from && t < part.to) value = part.level;
    return value;
  };
  // Drone: a minor fifth stack that swells with intensity.
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / RATE;
    p1 += (2 * Math.PI * 73.4) / RATE;
    p2 += (2 * Math.PI * 110) / RATE;
    p3 += (2 * Math.PI * 87.3) / RATE;
    const swell = 0.5 + 0.5 * Math.sin(t * 0.7);
    out[i] = (Math.sin(p1) * 0.5 + Math.sin(p2) * 0.25 + Math.sin(p3) * 0.18 * swell) * 0.06 * (0.6 + intensity(t) * 0.25);
  }
  const kick = envelope(sweep(0.35, 120, 42, 22), 0.002, 0.1);
  const snare = add([envelope(highpass(noise(0.2, rand), 1200), 0.001, 0.05), 0.7], [envelope(sweep(0.12, 240, 180, 10), 0.001, 0.04), 0.4]);
  const tom = envelope(sweep(0.5, 95, 70, 6), 0.003, 0.16);
  const hat = envelope(highpass(noise(0.05, rand), 7000), 0.001, 0.012);
  const crash = envelope(highpass(noise(1.4, rand), 4500), 0.002, 0.45);
  const place = (signal, at, gain) => {
    const start = Math.round(at * RATE);
    for (let i = 0; i < signal.length && start + i < length; i += 1) out[start + i] += signal[i] * gain;
  };
  // Bass notes walk a short minor riff on eighths.
  const riff = [73.4, 73.4, 87.3, 73.4, 98, 73.4, 87.3, 65.4];
  const { times, snapped } = grid(duration, beat * 0.5, hits, music.locked);
  for (const [n, t] of times.entries()) {
    const level = intensity(t);
    if (level <= 0) continue;
    const inBar = n % 8;
    if (inBar % 2 === 0) place(kick, t, 0.32 * Math.min(level, 2));
    // A step that landed on a blow gets a kick and a crash of its own.
    if (snapped.has(n)) {
      if (inBar % 2 === 1) place(kick, t, 0.26 * Math.min(level, 2));
      if (level >= 2) place(crash, t, 0.05 + 0.02 * Math.min(level, 4));
    }
    if (level >= 2 && (inBar === 2 || inBar === 6)) place(snare, t, 0.18);
    if (level >= 3 && inBar === 7) place(tom, t, 0.22);
    // At full tilt: sixteenth-note hats and a tom answering every off-beat.
    if (level >= 4) {
      place(hat, t, 0.07);
      place(hat, t + beat * 0.25, 0.045);
      if (inBar % 2 === 1) place(tom, t, 0.16);
    }
    if (level >= 1) {
      const f = riff[inBar];
      const len = Math.round(beat * 0.45 * RATE);
      const start = Math.round(t * RATE);
      let phase = 0;
      for (let i = 0; i < len && start + i < length; i += 1) {
        phase += (2 * Math.PI * f) / RATE;
        const saw = ((phase / (2 * Math.PI)) % 1) * 2 - 1;
        out[start + i] += saw * 0.05 * Math.exp((-i / RATE) * 7) * Math.min(level, 2.5);
      }
    }
  }
  return lowpass(out, 5000);
}

/**
 * A stretch of a song as the soundtrack: from `track.start` seconds in, at
 * `track.gain`, dipped to `gain` inside each `duck` window (video seconds),
 * and faded out over the last moment of the scene.
 */
async function songBed(track, duration) {
  const length = Math.round(duration * RATE);
  const out = new Float32Array(length);
  out.set((await decode(track.file, { start: track.start, duration, rate: RATE })).subarray(0, length));
  const ramp = 0.15;
  const duckAt = t => {
    let level = 1;
    for (const d of track.duck ?? []) {
      const into = Math.min(1, Math.max(0, (t - d.from) / ramp));
      const outOf = Math.min(1, Math.max(0, (d.to - t) / ramp));
      level = Math.min(level, 1 - (1 - d.gain) * Math.min(into, outOf));
    }
    return level;
  };
  const fade = 1.5;
  for (let i = 0; i < length; i += 1) {
    const t = i / RATE;
    out[i] *= (track.gain ?? 0.6) * duckAt(t) * Math.min(1, (duration - 0.5 - t) / fade + 1 / fade);
  }
  return out;
}

/** A gentle limiter: untouched below 0.7, rounded off above it, never past 1. */
function limit(x) {
  const size = Math.abs(x);
  return size < 0.7 ? x : Math.sign(x) * (0.7 + 0.3 * Math.tanh((size - 0.7) / 0.3));
}

/**
 * A small Schroeder reverb: four damped combs in parallel, two allpasses in
 * series. It turns dry hits into blows that ring through a stone hall.
 */
function reverb(signal, { wet = 0.25, feedback = 0.8, damping = 0.35 } = {}) {
  const out = new Float32Array(signal.length);
  for (const delay of [1557, 1617, 1491, 1422]) {
    const line = new Float32Array(delay);
    let index = 0;
    let low = 0;
    for (let i = 0; i < signal.length; i += 1) {
      const delayed = line[index];
      low = delayed * (1 - damping) + low * damping;
      line[index] = signal[i] + low * feedback;
      out[i] += delayed * 0.25;
      index = (index + 1) % delay;
    }
  }
  for (const delay of [225, 556]) {
    const line = new Float32Array(delay);
    let index = 0;
    for (let i = 0; i < out.length; i += 1) {
      const delayed = line[index];
      const input = out[i];
      line[index] = input + delayed * 0.5;
      out[i] = delayed - input * 0.5;
      index = (index + 1) % delay;
    }
  }
  return signal.map((value, i) => value + out[i] * wet);
}

export async function mixAudio(sounds, duration, file, music) {
  const rand = random(99);
  const bank = makeSounds(rand);
  // Recorded effects where there are any, layered over the synthesised ones.
  const recorded = await loadSfx(RATE);
  const variety = random(7);
  // Blows the music should land on: the hit sounds, a fraction of a second apart at least.
  const blows = ['punch', 'heavy', 'block', 'clang', 'slash', 'energyHit'];
  const hits = sounds
    .filter(sound => blows.includes(sound.name))
    .map(sound => sound.time)
    .sort((a, b) => a - b)
    .filter((time, i, list) => i === 0 || time - list[i - 1] > 0.12);
  // A real song plays as the bed when the scene names one; otherwise the synthesised score.
  const mix = music?.track ? await songBed(music.track, duration + 0.5) : score(duration + 0.5, music, rand, hits);
  const effects = new Float32Array(mix.length);
  for (const { time, name, gain } of sounds) {
    const signal = voice(name, recorded, bank, variety) ?? bank[name];
    if (!signal) throw new Error(`No sound named "${name}".`);
    const start = Math.round(time * RATE);
    for (let i = 0; i < signal.length && start + i < effects.length; i += 1) effects[start + i] += signal[i] * 0.55 * gain;
  }
  const wet = reverb(effects);
  for (let i = 0; i < mix.length; i += 1) mix[i] += wet[i];
  // A mastered song leaves no headroom for the hits on top; round off just the peaks.
  if (music?.track) for (let i = 0; i < mix.length; i += 1) mix[i] = limit(mix[i]);
  // Keep the peaks under full scale without squashing the quiet parts.
  let peak = 0;
  for (const value of mix) peak = Math.max(peak, Math.abs(value));
  // 1dB of headroom, since AAC encoding overshoots the peaks a little.
  const scale = peak > 0.89 ? 0.89 / peak : 1;
  const pcm = Buffer.alloc(44 + mix.length * 2);
  pcm.write('RIFF', 0);
  pcm.writeUInt32LE(36 + mix.length * 2, 4);
  pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(RATE, 24);
  pcm.writeUInt32LE(RATE * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36);
  pcm.writeUInt32LE(mix.length * 2, 40);
  for (let i = 0; i < mix.length; i += 1) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i] * scale)) * 32767), 44 + i * 2);
  await writeFile(file, pcm);
}
