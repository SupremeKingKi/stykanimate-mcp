/**
 * Sync a fight to the music: retime the scene so every blow lands on a beat.
 *
 * The score keeps a steady tempo. Each impact is placed on the beat grid:
 * heavy blows on eighth notes, light ones on sixteenths. The scene's clock
 * is then bent smoothly between blows (a piecewise-linear time warp of
 * every key, effect, lunge, camera key and music section) so each blow
 * lands where the grid wants it. Hit-stops and slow motion are counted, so
 * the beat lines up with the finished video, not with scene time.
 */

/** Video time for a scene time, counting the hit-stops and slow motion before it. */
export function videoTime(scene) {
  // Hit-stops at the same moment overlap rather than add up.
  const stops = new Map();
  for (const e of scene.events) if (e.type === 'hitstop') stops.set(e.t, Math.max(stops.get(e.t) ?? 0, e.dur ?? 0.08));
  const slows = scene.events.filter(e => e.type === 'slowmo');
  return t => {
    let v = t;
    for (const [at, dur] of stops) if (at < t - 1e-9) v += dur;
    for (const s of slows) {
      const inside = Math.min(t, s.t + s.dur) - s.t;
      if (inside > 0) v += inside * (1 / s.scale - 1);
    }
    return v;
  };
}

/** A piecewise-linear time map through (old, new) anchor pairs, slope 1 past the last. */
function makeWarp(anchors) {
  const last = anchors[anchors.length - 1];
  return t => {
    if (t <= 0) return t;
    for (let i = 1; i < anchors.length; i += 1) {
      const [x0, y0] = anchors[i - 1];
      const [x1, y1] = anchors[i];
      if (t <= x1) return y0 + ((t - x0) * (y1 - y0)) / (x1 - x0 || 1);
    }
    return last[1] + (t - last[0]);
  };
}

/**
 * Replay the renderer's clock for `frames` frames, with the timing events
 * moved by `warp`, and return the scene time each frame sees. It follows
 * render.mjs: an event fires on the first frame whose scene time has reached
 * it, a hit-stop holds the scene for whole frames, slow motion scales the step.
 */
function simulate(timing, warp, fps, frames) {
  const dt = 1 / fps;
  // A slow-motion window ends where the renderer will see it end: its new start plus
  // its new length, computed the same way, so rounding cannot put them a frame apart.
  const events = timing
    .map(e => {
      const t = warp(e.t);
      return { ...e, t, end: e.type === 'slowmo' ? t + (warp(e.t + e.dur) - t) : 0 };
    })
    .sort((a, b) => a.t - b.t);
  const slows = events.filter(e => e.type === 'slowmo');
  const scale = t => slows.reduce((s, e) => (t >= e.t && t < e.end ? Math.min(s, e.scale) : s), 1);
  const clock = [];
  let sceneTime = 0;
  let freeze = 0;
  let next = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const step = freeze > 0 ? 0 : dt * scale(sceneTime);
    clock.push(sceneTime);
    while (next < events.length && events[next].t <= sceneTime + 1e-6) {
      if (events[next].type === 'hitstop') freeze = Math.max(freeze, events[next].dur ?? 0.08);
      next += 1;
    }
    if (freeze > 0) freeze -= dt;
    else sceneTime += step;
  }
  return clock;
}

/**
 * Retime `scene` in place so its impacts land on the beat of `bpm`.
 * Returns the warp (old scene time to new) for anything else the scene
 * keeps its own times for, and a list of where each blow landed.
 */
export function syncToBeat(scene, { bpm = scene.music?.bpm ?? 150, fps = 30, minSlope = 0.45, maxSlope = 2.2 } = {}) {
  const beat = 60 / bpm;
  // Where the grid starts in the video: a song's first beat, or zero for the synthesised score.
  const origin = scene.music?.offset ?? 0;
  const toVideo = videoTime(scene);
  // One entry per moment something lands; a heavy blow sets the grid for the moment.
  const moments = new Map();
  for (const e of scene.events) {
    if (e.type !== 'impact') continue;
    const strong = (e.size ?? 1) >= 1.3 || ['heavy', 'dark'].includes(e.kind);
    moments.set(e.t, (moments.get(e.t) ?? false) || strong);
  }
  const hits = [...moments].map(([t, strong]) => ({ t, strong })).sort((a, b) => a.t - b.t);

  const anchors = [[0, 0]];
  const landed = [];
  let previous = { t: 0, video: 0, target: 0 };
  for (const hit of hits) {
    const video = toVideo(hit.t);
    const step = hit.strong ? beat / 2 : beat / 4;
    // The grid slots near this blow, closest first. Keep the first one that
    // does not squeeze or stretch the time since the last blow too far.
    const span = video - previous.video;
    const candidates = [];
    for (let k = -2; k <= 3; k += 1) candidates.push(origin + Math.round((video - origin) / step) * step + k * step);
    candidates.sort((a, b) => Math.abs(a - video) - Math.abs(b - video));
    let target = candidates.find(c => {
      const slope = (c - previous.target) / (span || 1e-6);
      return c > previous.target + 0.05 && slope >= minSlope && slope <= maxSlope;
    });
    // Too crowded to place on the grid at all: leave the blow where it is, in order.
    if (target === undefined) target = Math.max(video, previous.target + 0.05);
    anchors.push([hit.t, hit.t + (target - video)]);
    landed.push({ scene: hit.t, video, target, strong: hit.strong });
    previous = { t: hit.t, video, target };
  }

  // The estimate above ignores that the video moves in whole frames: a
  // hit-stop lasts a whole number of frames and an event fires on the first
  // frame at or after its time. So replay the renderer's clock and, blow by
  // blow, move each one until it fires on the exact frame its beat falls on.
  // First pin it to the scene time that frame sees; if that frame is inside a
  // hit-stop (scene time standing still, so nothing can fire there), nudge it
  // by the frames it missed, which moves the hit-stop before it along too.
  const timing = scene.events.filter(e => ['impact', 'hitstop', 'slowmo'].includes(e.type));
  const dt = 1 / fps;
  for (let i = 1; i < anchors.length; i += 1) {
    const frame = Math.round(landed[i - 1].target * fps);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const clock = simulate(timing, makeWarp(anchors), fps, frame + 60);
      const at = anchors[i][1];
      const fired = clock.findIndex(sceneTime => sceneTime >= at - 1e-6);
      if (fired === frame) break;
      const moving = frame > 0 && clock[frame] > clock[frame - 1] + 1e-9;
      const next = attempt === 0 && moving ? clock[frame] : at + (frame - (fired < 0 ? frame : fired)) * dt * 0.9;
      if (next <= anchors[i - 1][1] + 1e-4 || next === at) break;
      for (let j = i; j < anchors.length; j += 1) anchors[j][1] += next - at;
    }
  }
  const warp = makeWarp(anchors);

  // Move everything that has a time.
  for (const track of Object.values(scene.tracks)) {
    for (const key of track.keys) key.t = warp(key.t);
    for (const nudge of track.nudges) {
      const at = nudge.t;
      nudge.t = warp(at);
      nudge.rise = nudge.t - warp(at - nudge.rise);
      nudge.fall = warp(at + nudge.fall) - nudge.t;
    }
  }
  for (const e of scene.events) {
    const at = e.t;
    e.t = warp(at);
    // Durations in scene time stretch with it; hit-stops are video time and stay.
    if (e.type === 'slowmo' || e.type === 'say') e.dur = warp(at + e.dur) - e.t;
  }
  for (const key of scene.camera) key.t = warp(key.t);
  if (scene.music) {
    scene.music.sections = (scene.music.sections ?? []).map(part => ({ ...part, from: warp(part.from), to: warp(part.to) }));
    if (scene.music.track?.duck) scene.music.track.duck = scene.music.track.duck.map(d => ({ ...d, from: warp(d.from), to: warp(d.to) }));
    // The score keeps its tempo now; the fight follows it.
    scene.music.locked = true;
  }
  scene.duration = warp(scene.duration);
  return { warp, landed, beat };
}
