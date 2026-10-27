#!/usr/bin/env node
/**
 * Render a fight scene to an MP4, or to contact sheets for checking moves.
 *
 * Usage:
 *   node fight/render.mjs <scene.mjs> --out fight/out/fight.mp4 [--fps 30] [--size 1280x720] [--no-audio]
 *   node fight/render.mjs <scene.mjs> --sheet 6-8:0.1 --out fight/out/sheet.png [--cell 320]
 *   node fight/render.mjs <scene.mjs> --sheet 6.1,6.25,7 --out fight/out/sheet.png
 *
 * Sheet times are scene seconds, before hit-stops stretch them.
 */
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { Actor } from './characters.mjs';
import { Effects, drawSpeech } from './effects.mjs';
import { lowestPoint, mix, solve } from './rig.mjs';
import { drawForeground, drawStage, GROUND } from './stage.mjs';
import { EASE } from './timeline.mjs';
import { mixAudio } from './audio.mjs';
import { FootLock } from './feet.mjs';

function parseArgs(argv) {
  const options = { scene: null, out: null, fps: 30, width: 1280, height: 720, sheet: null, cell: 320, audio: true, feet: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') options.out = argv[++i];
    else if (arg === '--fps') options.fps = Number(argv[++i]);
    else if (arg === '--size') [options.width, options.height] = argv[++i].split('x').map(Number);
    else if (arg === '--sheet') options.sheet = parseTimes(argv[++i]);
    else if (arg === '--cell') options.cell = Number(argv[++i]);
    else if (arg === '--no-audio') options.audio = false;
    else if (arg === '--no-feet') options.feet = false;
    else if (!options.scene) options.scene = arg;
    else throw new Error(`Unknown argument "${arg}".`);
  }
  if (!options.scene) throw new Error('Name a scene module.');
  return options;
}

function parseTimes(text) {
  const range = /^([\d.]+)-([\d.]+):([\d.]+)$/.exec(text);
  if (range) {
    const [from, to, step] = range.slice(1).map(Number);
    const times = [];
    for (let t = from; t <= to + 1e-6; t += step) times.push(Math.round(t * 1000) / 1000);
    return times;
  }
  return text.split(',').map(Number);
}

/**
 * Camera keys hold x, y, zoom, dim, bars and fade; a key may follow figures
 * instead of naming x. A key with `fit: [min, max]` zooms to frame the
 * figures it follows as tightly as that range allows, and puts the floor low
 * in the frame unless it names y.
 */
function cameraAt(keys, t, actors, view) {
  const resolve = key => {
    if (!key.follow) return key.x;
    const xs = key.follow.map(id => actors.get(id).place?.x ?? 0);
    return (Math.min(...xs) + Math.max(...xs)) / 2 + (key.ox ?? 0);
  };
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i += 1;
  const a = keys[i];
  const b = keys[i + 1] ?? a;
  const raw = b === a ? 0 : Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  const s = (EASE[b.ease] ?? EASE.inOut)(raw);
  const lerp = (field, fallback) => (a[field] ?? fallback) + ((b[field] ?? a[field] ?? fallback) - (a[field] ?? fallback)) * s;
  // A following camera rises with figures in the air, so aerial fights stay in frame.
  const lift = key => (key.follow ? Math.max(...key.follow.map(id => actors.get(id).state?.air ?? 0)) * 0.55 : 0);
  const zoomOf = key => {
    if (!key.fit) return key.zoom ?? 1;
    const xs = key.follow.map(id => actors.get(id).place?.x ?? 0);
    const span = Math.max(...xs) - Math.min(...xs);
    // Pull back for figures high in the air, so a juggle stays in the shot.
    const air = Math.max(...key.follow.map(id => actors.get(id).state?.air ?? 0));
    const fit = Math.min((view.width * 0.7) / (span + 200), (view.height * 0.72) / (air + 250));
    return Math.min(key.fit[1], Math.max(Math.min(key.fit[0], fit), fit));
  };
  const yOf = key => key.y ?? GROUND - (view.height * 0.27) / zoomOf(key);
  return {
    x: resolve(a) + (resolve(b) - resolve(a)) * s,
    y: yOf(a) + (yOf(b) - yOf(a)) * s - (lift(a) + (lift(b) - lift(a)) * s),
    zoom: zoomOf(a) + (zoomOf(b) - zoomOf(a)) * s,
    dim: lerp('dim', 0),
    bars: lerp('bars', 0),
    fade: lerp('fade', 0),
  };
}

export async function render(scene, options) {
  const { fps, width, height } = options;
  const view = { width, height };
  const dt = 1 / fps;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const actors = new Map(scene.order.map(id => [id, new Actor(id)]));
  const effects = new Effects(scene.seed ?? 11);
  effects.useSprites(await loadSprites());
  const events = scene.events.filter(event => event.type !== 'slowmo').sort((a, b) => a.t - b.t);
  // Slow motion: scene time runs at a fraction of video time inside these windows.
  const slowmos = scene.events.filter(event => event.type === 'slowmo');
  const timeScale = t => slowmos.reduce((scale, e) => (t >= e.t && t < e.t + e.dur ? Math.min(scale, e.scale) : scale), 1);
  // Post effects on the finished frame: zoom punches, camera tilt, colour split and impact frames.
  const post = { punches: [], tilts: [], splits: [], impactFrames: 0, impactIndex: 0 };
  const output = createCanvas(width, height);
  const sounds = [];
  let nextEvent = 0;

  // Scene time stands still during a hit-stop while video time runs on.
  let sceneTime = 0;
  let freeze = 0;
  let videoTime = 0;
  const shakes = [];
  const speech = [];
  const history = new Map(scene.order.map(id => [id, { ghosts: [], trail: [] }]));
  let smoothX = null;
  let smoothZoom = null;
  let smoothY = null;
  const eyes = new Map(scene.order.map(id => [id, []]));
  // Every blow jolts whoever takes it, on top of whatever their keys say.
  const recoils = new Map(scene.order.map(id => [id, []]));
  // Planted feet stay put while the body moves over them.
  const feet = new Map(scene.order.map(id => [id, new FootLock({ enabled: options.feet !== false })]));

  const wantSheet = options.sheet ? [...options.sheet] : null;
  const sheetFrames = [];
  let encoder = null;
  if (!wantSheet) encoder = startEncoder(options);

  const totalFrames = Math.ceil(scene.duration * fps * 1.2) + 1;
  // Scene time against video time, frame by frame, so the score can follow hit-stops and slow motion.
  const clock = [];
  let frame = 0;
  while (sceneTime <= scene.duration && frame < totalFrames * 3) {
    const step = freeze > 0 ? 0 : dt * timeScale(sceneTime);
    // Figures.
    for (const [id, actor] of actors) {
      const state = scene.tracks[id].at(sceneTime);
      if (state.breathe) {
        const beat = Math.sin(sceneTime * 3.2 + id.length);
        state.pose.lean += beat * state.breathe * 2;
        state.pose.fs += beat * state.breathe * 4;
        state.pose.bs += beat * state.breathe * 3;
      }
      applyRecoil(state, recoils.get(id), sceneTime);
      const before = actor.place;
      state.y = GROUND - lowestPoint(solve(state.pose, actor.look.scale)) - state.air;
      feet.get(id).apply(state, actor.look.scale, sceneTime);
      state.vx = before && step > 0 ? (state.x - before.x) / dt : 0;
      actor.update(state, Math.max(step, 0.0001));
    }

    // Events whose moment has come.
    while (nextEvent < events.length && events[nextEvent].t <= sceneTime + 1e-9) {
      fire(events[nextEvent], { actors, effects, shakes, speech, sounds, videoTime, sceneTime, post, recoils, onFreeze: d => (freeze = Math.max(freeze, d)) });
      nextEvent += 1;
    }

    // Auras throw off embers, and a strong one crackles with lightning.
    for (const actor of actors.values()) {
      if (actor.state.aura > 0.05 && frame % 2 === 0) {
        const chest = actor.point('chest');
        effects.embers(chest.x, chest.y, { color: actor.state.auraColor ?? '#ff3050', count: Math.ceil(actor.state.aura * 3), spread: 50 * actor.look.scale });
      }
      if (actor.state.aura > 0.75 && frame % 5 === 0 && effects.sprites.has('lightning-effect')) {
        const chest = actor.point('chest');
        const r = effects.rand;
        effects.sprite('lightning-effect', chest.x + (r() - 0.5) * 60, chest.y + (r() - 0.3) * 90, {
          scale: 0.16 + r() * 0.12,
          rotation: r() * Math.PI * 2,
          tint: actor.state.auraColor === '#a070ff' ? '#c9a6ff' : '#ff3048',
          additive: true,
          speed: 2.2,
        });
      }
    }
    effects.update(freeze > 0 ? dt : step);

    // Camera, with a little lag when it follows, plus shake.
    const cam = cameraAt(scene.camera, sceneTime, actors, view);
    smoothX = smoothX === null ? cam.x : smoothX + (cam.x - smoothX) * 0.18;
    smoothZoom = smoothZoom === null ? cam.zoom : smoothZoom + (cam.zoom - smoothZoom) * 0.12;
    cam.zoom = smoothZoom;
    smoothY = smoothY === null ? cam.y : smoothY + (cam.y - smoothY) * 0.14;
    cam.x = smoothX;
    cam.y = smoothY;
    cam.zoom *= 1 + decaying(post.punches, videoTime);
    let shakeX = 0;
    let shakeY = 0;
    for (let i = shakes.length - 1; i >= 0; i -= 1) {
      const shake = shakes[i];
      const age = videoTime - shake.start;
      if (age > shake.dur) {
        shakes.splice(i, 1);
        continue;
      }
      const power = shake.amount * (1 - age / shake.dur);
      shakeX += Math.sin(age * 91 + i) * power;
      shakeY += Math.cos(age * 73 + i * 2) * power * 0.7;
    }
    cam.shakeX = shakeX;
    cam.shakeY = shakeY;

    for (const [id, actor] of actors) {
      const h = history.get(id);
      h.ghosts.unshift({ solved: actor.solved, state: actor.state, place: actor.place, speed: Math.abs(actor.state.vx), reach: ['fist', 'backFist', 'foot', 'backFoot'].map(name => actor.point(name)) });
      h.ghosts.length = Math.min(h.ghosts.length, 5);
      h.trail.unshift(actor.state.trail === false ? null : actor.weaponLine());
      h.trail.length = Math.min(h.trail.length, 6);
      if (actor.look.horns) {
        const trail = eyes.get(id);
        trail.unshift(actor.eye());
        trail.length = Math.min(trail.length, 9);
        h.eyes = trail;
      }
    }

    const sheetHit = wantSheet && wantSheet.length && sceneTime + 1e-9 >= wantSheet[0];
    if (!wantSheet || sheetHit) {
      paint(ctx, { scene, cam, view, actors, effects, history, speech, sceneTime, videoTime });
      const shakeTilt = (Math.abs(shakeX) + Math.abs(shakeY)) * 0.06 * Math.sign(shakeX || 1);
      const finished = finish(canvas, output, post, videoTime, decaying(post.tilts, videoTime) + shakeTilt);
      if (encoder) await encoder.write(finished.data());
      else {
        while (wantSheet.length && sceneTime + 1e-9 >= wantSheet[0]) {
          sheetFrames.push({ t: wantSheet.shift(), png: await finished.encode('png') });
        }
      }
    }
    if (wantSheet && !wantSheet.length) break;

    // Impact frames count video frames, drawn or not.
    if (post.impactFrames > 0) {
      post.impactFrames -= 1;
      post.impactIndex += 1;
    }
    clock.push([sceneTime, videoTime]);
    frame += 1;
    videoTime += dt;
    if (freeze > 0) freeze -= dt;
    else sceneTime += step;
  }

  if (encoder) {
    await encoder.close();
    return { frames: frame, videoTime, sounds, clock, feet };
  }
  return { sheetFrames, feet };
}

function point(actors, spec) {
  if (typeof spec === 'object') return spec;
  const [id, name] = spec.split('.');
  return actors.get(id).point(name ?? 'chest');
}

function at(actors, event) {
  if (event.x !== undefined) return { x: event.x, y: event.y ?? GROUND };
  const base = point(actors, event.at);
  const facing = event.at ? actors.get(event.at.split('.')[0]).place.facing : 1;
  return { x: base.x + (event.ox ?? 0) * facing, y: base.y + (event.oy ?? 0) };
}

/**
 * Who threw a blow: the figure named, if the hit is at its fist, foot or
 * weapon; otherwise whoever has a fist, foot or blade nearest the hit.
 */
function attacker(actors, event, p) {
  if (!event.at) return null;
  const [id, name] = event.at.split('.');
  if (['fist', 'backFist', 'foot', 'backFoot', 'tip'].includes(name)) return actors.get(id);
  let best = null;
  let bestDistance = Infinity;
  for (const [other, actor] of actors) {
    if (other === id) continue;
    for (const part of ['fist', 'backFist', 'foot', 'backFoot', 'tip']) {
      const q = actor.point(part);
      const distance = Math.hypot(q.x - p.x, q.y - p.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = actor;
      }
    }
  }
  return best;
}

/** Who takes a blow: the figure named at the hit, or, for a hit at a fist or blade, whoever is nearest it. */
function victim(actors, event, p, by) {
  if (!event.at) return null;
  const named = actors.get(event.at.split('.')[0]);
  if (named !== by) return named;
  let best = null;
  let bestDistance = Infinity;
  for (const actor of actors.values()) {
    if (actor === by) continue;
    const chest = actor.point('chest');
    const distance = Math.hypot(chest.x - p.x, chest.y - p.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = actor;
    }
  }
  return best;
}

/**
 * Jolt a figure that was just hit: the trunk snaps away from the blow, the
 * head whips a moment later, the arms fly up and the body is shoved a
 * little, then it all springs back. It shows at once, even through a hit-stop.
 */
function applyRecoil(state, list, now) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const { start, strength, dir } = list[i];
    const age = now - start;
    if (age > 0.7) {
      list.splice(i, 1);
      continue;
    }
    const pulse = a => (a < 0 ? 0 : a < 0.04 ? 0.6 + 10 * a : Math.exp(-(a - 0.04) / 0.13));
    const body = pulse(age) * strength;
    const head = pulse(age - 0.04) * strength;
    // Positive leans the way the figure faces; a blow from the front leans it back.
    const away = dir * state.facing;
    state.pose.lean += 14 * body * away;
    state.pose.head += 22 * head * away;
    state.pose.fs += 12 * body;
    state.pose.bs += 16 * body;
    state.pose.fe -= 10 * head;
    state.x += dir * 9 * body;
  }
}

function fire(event, { actors, effects, shakes, speech, sounds, videoTime, sceneTime, post, recoils, onFreeze }) {
  const sound = (name, gain = 1) => sounds.push({ time: videoTime, name, gain });
  switch (event.type) {
    case 'impact': {
      const p = at(actors, event);
      const by = attacker(actors, event, p);
      effects.impact(p.x, p.y, { kind: event.kind, size: event.size ?? 1, angle: event.angle ?? 0, tint: by?.look.signature });
      const target = victim(actors, event, p, by);
      if (target && by) {
        const size = event.size ?? 1;
        const strength = ['block', 'clang'].includes(event.kind) ? 0.65 : size < 1.3 ? 0.6 + 0.25 * size : Math.min(1.6, 1.1 + 0.2 * (size - 1.3));
        recoils.get(target.id).push({ start: sceneTime, strength, dir: Math.sign(target.place.x - by.place.x) || -target.place.facing });
      }
      sound(event.sound ?? { hit: 'punch', heavy: 'heavy', block: 'block', clang: 'clang', slash: 'slash', dark: 'heavy', purple: 'energyHit' }[event.kind ?? 'hit'], event.gain ?? 1);
      break;
    }
    case 'dust': {
      const p = at(actors, event);
      effects.dust(p.x, { size: event.size ?? 1, count: event.count ?? 8, dir: event.dir ?? 0 });
      break;
    }
    case 'debris': {
      const p = at(actors, event);
      effects.debris(p.x, { count: event.count ?? 14, size: event.size ?? 1 });
      break;
    }
    case 'ring': {
      const p = at(actors, event);
      effects.ring(p.x, p.y, { color: event.color ?? 'rgba(255,255,255,', size: event.size ?? 1, life: event.life ?? 0.4, squash: event.squash ?? 0.55 });
      break;
    }
    case 'sparks': {
      const p = at(actors, event);
      effects.sparks(p.x, p.y, event);
      break;
    }
    case 'slashLine': {
      const from = at(actors, { at: event.at, ox: event.from[0], oy: event.from[1] });
      const to = at(actors, { at: event.at, ox: event.to[0], oy: event.to[1] });
      effects.slashLine(from.x, from.y, to.x, to.y, event);
      sound('slash', 1.2);
      break;
    }
    case 'wave': {
      const from = at(actors, { at: event.from });
      const to = at(actors, { at: event.to });
      effects.wave(from.x, to.x, from.y, { life: event.life ?? 0.3, size: event.size ?? 1 });
      sound('energy');
      break;
    }
    case 'flash':
      effects.flash(event);
      break;
    case 'speedLines':
      effects.speedLines(event);
      break;
    case 'shake':
      shakes.push({ start: videoTime, amount: event.amount ?? 8, dur: event.dur ?? 0.3 });
      break;
    case 'hitstop':
      onFreeze(event.dur ?? 0.08);
      break;
    case 'say':
      speech.push(event);
      break;
    case 'sfx':
      sound(event.name, event.gain ?? 1);
      break;
    case 'sprite': {
      const p = at(actors, event);
      if (event.ground) p.y = GROUND;
      const facing = event.at ? actors.get(event.at.split('.')[0]).place.facing : 1;
      effects.sprite(event.name, p.x, p.y, { ...event, flip: (event.flip ?? 1) * (event.faceActor ? facing : 1) });
      break;
    }
    case 'crack': {
      const p = at(actors, event);
      effects.crack(p.x, event);
      break;
    }
    case 'punch':
      post.punches.push({ start: videoTime, amount: event.amount ?? 0.12, dur: event.dur ?? 0.3 });
      break;
    case 'tilt':
      post.tilts.push({ start: videoTime, amount: event.angle ?? 4, dur: event.dur ?? 0.5 });
      break;
    case 'split':
      post.splits.push({ start: videoTime, amount: event.amount ?? 8, dur: event.dur ?? 0.25 });
      break;
    case 'impactFrames':
      post.impactFrames = event.count ?? 3;
      post.impactIndex = 0;
      break;
    default:
      throw new Error(`Unknown event type "${event.type}".`);
  }
}

function paint(ctx, { scene, cam, view, actors, effects, history, speech, sceneTime, videoTime }) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  drawStage(ctx, cam, view, { dim: cam.dim, time: videoTime });

  const world = () => ctx.setTransform(cam.zoom, 0, 0, cam.zoom, view.width / 2 - cam.x * cam.zoom + cam.shakeX, view.height / 2 - cam.y * cam.zoom + cam.shakeY);
  world();

  // Soft shadows on the floor.
  for (const actor of actors.values()) {
    const s = actor.state;
    if ((s.opacity ?? 1) <= 0.01) continue;
    const lift = Math.min(1, s.air / 250);
    ctx.fillStyle = `rgba(30,30,40,${0.22 * (1 - lift) * (s.opacity ?? 1)})`;
    ctx.beginPath();
    ctx.ellipse(s.x, GROUND + 2, 34 * actor.look.scale * (1 - lift * 0.5), 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  effects.drawDecals(ctx);

  for (const id of scene.order) {
    const actor = actors.get(id);
    const h = history.get(id);
    const s = actor.state;
    if ((s.opacity ?? 1) <= 0.01) continue;

    // An aura glows behind a figure that is powering up.
    if (s.aura > 0.02) {
      const chest = actor.point('chest');
      const pulse = 1 + Math.sin(videoTime * 14) * 0.06;
      const radius = 120 * actor.look.scale * pulse * (0.6 + s.aura * 0.6);
      const glow = ctx.createRadialGradient(chest.x, chest.y, 0, chest.x, chest.y, radius);
      const c = s.auraColor === '#a070ff' ? '160,110,255' : '255,30,60';
      glow.addColorStop(0, `rgba(${c},${0.55 * s.aura})`);
      glow.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(chest.x, chest.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    drawSmear(ctx, actor, h);

    // A ribbon behind a swinging weapon, in the fighter's colour.
    drawTrail(ctx, h.trail, rgb(actor.look.signature));

    actor.draw(ctx, { glow: s.aura });
    if (h.eyes && s.aura > 0.3) drawEyeTrail(ctx, h.eyes, s.aura, actor.look.scale);
  }

  effects.drawWorld(ctx);
  drawForeground(ctx, cam, view, { dim: cam.dim });

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  effects.drawScreen(ctx, view);

  // Speech, anchored over each speaker's head.
  for (let i = speech.length - 1; i >= 0; i -= 1) {
    const line = speech[i];
    const progress = (sceneTime - line.t) / line.dur;
    if (progress > 1) {
      speech.splice(i, 1);
      continue;
    }
    const head = actors.get(line.who).point('head');
    const anchor = { x: (head.x - cam.x) * cam.zoom + view.width / 2, y: (head.y - 40 * actors.get(line.who).look.scale - cam.y) * cam.zoom + view.height / 2 };
    drawSpeech(ctx, line.text, progress, anchor, { color: line.color ?? '#16161c' });
  }

  // Vignette, letterbox and fades.
  const vignette = ctx.createRadialGradient(view.width / 2, view.height / 2, view.height * 0.45, view.width / 2, view.height / 2, view.height * 0.95);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, `rgba(0,0,0,${0.35 + cam.dim * 0.3})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, view.width, view.height);
  if (cam.bars > 0) {
    ctx.fillStyle = '#000';
    const bar = 70 * cam.bars;
    ctx.fillRect(0, 0, view.width, bar);
    ctx.fillRect(0, view.height - bar, view.width, bar);
  }
  if (scene.overlay) scene.overlay(ctx, view, sceneTime);
  if (cam.fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${cam.fade})`;
    ctx.fillRect(0, 0, view.width, view.height);
  }
}

/** The sum of a list of decaying kicks (zoom punches, tilts), at video time `now`. */
function decaying(list, now) {
  let total = 0;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const age = now - list[i].start;
    if (age > list[i].dur) list.splice(i, 1);
    else total += list[i].amount * (1 - age / list[i].dur) ** 2;
  }
  return total;
}

/**
 * Finish a frame: tilt the camera, flash impact frames (stark inverted
 * black and white, the anime way), and split the colour channels on big hits.
 */
function finish(canvas, output, post, now, tiltDegrees) {
  const split = decaying(post.splits, now);
  const impact = post.impactFrames > 0;
  const flip = post.impactIndex % 2 === 0;
  if (Math.abs(tiltDegrees) < 0.05 && split < 0.5 && !impact) return canvas;
  const { width, height } = canvas;
  const ctx = output.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  const angle = (tiltDegrees * Math.PI) / 180;
  // Grow the picture a little as it turns, so no corner shows.
  const cover = 1 + Math.abs(Math.sin(angle)) * 1.1;
  ctx.translate(width / 2, height / 2);
  ctx.rotate(angle);
  ctx.scale(cover, cover);
  ctx.translate(-width / 2, -height / 2);
  if (impact) {
    ctx.filter = flip ? 'grayscale(1) invert(1) contrast(7)' : 'grayscale(1) contrast(9) brightness(1.2)';
  }
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
  if (split >= 0.5) {
    const shift = Math.round(split);
    const image = ctx.getImageData(0, 0, width, height);
    const source = Uint8ClampedArray.from(image.data);
    const data = image.data;
    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      for (let x = 0; x < width; x += 1) {
        const i = (row + x) * 4;
        data[i] = source[(row + Math.min(width - 1, x + shift)) * 4];
        data[i + 2] = source[(row + Math.max(0, x - shift)) * 4 + 2];
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  return output;
}

/** A red streak that follows the boss's eye when he moves. */
function drawEyeTrail(ctx, points, strength, scale) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.shadowColor = '#ff1a1a';
  ctx.shadowBlur = 12;
  for (let i = 1; i < points.length; i += 1) {
    ctx.strokeStyle = `rgba(255,40,40,${0.8 * strength * (1 - i / points.length)})`;
    ctx.lineWidth = 4 * scale * (1 - i / points.length) + 1;
    ctx.beginPath();
    ctx.moveTo(points[i - 1].x, points[i - 1].y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Load the clip sprites baked by bake-clips.mjs, each with a recolouring helper. */
async function loadSprites(folder = 'fight/assets/sprites') {
  const sprites = new Map();
  let names = [];
  try {
    names = (await readdir(folder)).filter(name => name.endsWith('.json'));
  } catch {
    return sprites;
  }
  for (const name of names) {
    const meta = JSON.parse(await readFile(path.join(folder, name), 'utf8'));
    const image = await loadImage(path.join(folder, name.replace(/\.json$/, '.png')));
    const tints = new Map();
    sprites.set(name.replace(/\.json$/, ''), {
      meta,
      image,
      tinted(color) {
        if (!tints.has(color)) {
          const canvas = createCanvas(image.width, image.height);
          const c = canvas.getContext('2d');
          c.drawImage(image, 0, 0);
          c.globalCompositeOperation = 'source-in';
          c.fillStyle = color;
          c.fillRect(0, 0, image.width, image.height);
          tints.set(color, canvas);
        }
        return tints.get(color);
      },
    });
  }
  return sprites;
}

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');

/**
 * Smears: when a limb or the whole body moves far in one frame, draw the
 * in-between poses flat in the fighter's colour, so the motion reads as one
 * stretched stroke rather than a jump.
 */
function drawSmear(ctx, actor, h) {
  const [now, before] = h.ghosts;
  if (!now || !before || !before.state) return;
  const travel = Math.max(...now.reach.map((point, i) => Math.hypot(point.x - before.reach[i].x, point.y - before.reach[i].y)));
  const body = Math.hypot(now.state.x - before.state.x, now.state.y - before.state.y);
  if (travel < 32 && body < 22) return;
  const color = actor.look.signature;
  const steps = travel > 70 || body > 40 ? 4 : 2;
  for (let i = 1; i <= steps; i += 1) {
    const f = i / (steps + 1);
    const state = {
      ...now.state,
      pose: mix(before.state.pose, now.state.pose, f),
      x: before.state.x + (now.state.x - before.state.x) * f,
      y: before.state.y + (now.state.y - before.state.y) * f,
      facing: now.state.facing,
      opacity: 1,
    };
    actor.drawPose(ctx, state, { silhouette: color, alpha: 0.16 + 0.3 * f });
  }
  // Older frames linger faintly behind a figure that is really flying.
  if (body > 30) {
    for (let i = h.ghosts.length - 1; i >= 2; i -= 1) {
      const ghost = h.ghosts[i];
      if (ghost.state) actor.drawPose(ctx, { ...ghost.state, opacity: 1 }, { silhouette: color, alpha: 0.12 * (1 - i / h.ghosts.length) });
    }
  }
}

function drawTrail(ctx, trail, rgb) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < trail.length - 1; i += 1) {
    const a = trail[i];
    const b = trail[i + 1];
    if (!a || !b) break;
    const travel = Math.hypot(a.tip.x - b.tip.x, a.tip.y - b.tip.y);
    // Only a real swing leaves a ribbon, not a weapon carried along at a run.
    if (travel < 28) continue;
    const midA = { x: a.grip.x + (a.tip.x - a.grip.x) * 0.6, y: a.grip.y + (a.tip.y - a.grip.y) * 0.6 };
    const midB = { x: b.grip.x + (b.tip.x - b.grip.x) * 0.6, y: b.grip.y + (b.tip.y - b.grip.y) * 0.6 };
    ctx.fillStyle = `rgba(${rgb},${0.5 * (1 - i / trail.length) * Math.min(1, (travel - 28) / 40)})`;
    ctx.beginPath();
    ctx.moveTo(a.tip.x, a.tip.y);
    ctx.lineTo(b.tip.x, b.tip.y);
    ctx.lineTo(midB.x, midB.y);
    ctx.lineTo(midA.x, midA.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function startEncoder(options) {
  const silent = `${options.out}.video.mp4`;
  const args = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${options.width}x${options.height}`, '-r', String(options.fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', options.audio ? silent : options.out];
  const child = spawn(process.env.FFMPEG ?? 'ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
  return {
    silent,
    write(buffer) {
      return new Promise(resolve => {
        if (child.stdin.write(buffer)) resolve();
        else child.stdin.once('drain', resolve);
      });
    },
    async close() {
      child.stdin.end();
      await done;
    },
  };
}

async function sheet(frames, options) {
  const { loadImage } = await import('@napi-rs/canvas');
  const cell = options.cell;
  const cellH = Math.round((cell * options.height) / options.width);
  const cols = Math.min(4, frames.length);
  const rows = Math.ceil(frames.length / cols);
  const out = createCanvas(cols * (cell + 6) + 6, rows * (cellH + 24) + 6);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, out.width, out.height);
  for (const [i, f] of frames.entries()) {
    const x = 6 + (i % cols) * (cell + 6);
    const y = 6 + Math.floor(i / cols) * (cellH + 24);
    ctx.drawImage(await loadImage(f.png), x, y, cell, cellH);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText(`${f.t.toFixed(2)}s`, x + 4, y + cellH + 16);
  }
  await writeFile(options.out, await out.encode('png'));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const { build } = await import(pathToFileURL(path.resolve(options.scene)).href);
  const scene = build();
  options.out ??= options.sheet ? 'fight/out/sheet.png' : 'fight/out/fight.mp4';
  await mkdir(path.dirname(options.out), { recursive: true });
  const started = Date.now();
  const outcome = await render(scene, options);
  if (options.sheet) {
    await sheet(outcome.sheetFrames, options);
    console.log(`Wrote ${options.out} (${outcome.sheetFrames.length} frames).`);
  } else {
    if (options.audio) {
      const wav = `${options.out}.wav`;
      await mixAudio(outcome.sounds, outcome.videoTime, wav, scene.music && toVideoTime(scene.music, outcome.clock));
      await muxAudio(`${options.out}.video.mp4`, wav, options.out);
    }
    console.log(`Wrote ${options.out}: ${outcome.frames} frames, ${outcome.videoTime.toFixed(2)}s, rendered in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
    for (const [id, lock] of outcome.feet) console.log(`  ${id}: planted feet slid ${Math.round(lock.skate)}px in all, ${lock.steps} steps${lock.enabled ? '' : ' (foot locking off)'}`);
  }
}

/** Move the score's sections from scene seconds onto the video's clock. */
function toVideoTime(music, clock) {
  const video = t => (clock.find(([scene]) => scene >= t) ?? clock[clock.length - 1])[1];
  return { ...music, sections: music.sections.map(part => ({ ...part, from: video(part.from), to: part.to >= clock[clock.length - 1][0] ? Infinity : video(part.to) })) };
}

async function muxAudio(video, wav, out) {
  const { rm } = await import('node:fs/promises');
  await new Promise((resolve, reject) => {
    const child = spawn(process.env.FFMPEG ?? 'ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
  await rm(video, { force: true });
  await rm(wav, { force: true });
}
