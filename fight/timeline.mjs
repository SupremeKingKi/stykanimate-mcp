/**
 * Tracks of keyframes, and the moves that write them.
 *
 * A track holds one character's keys in scene seconds. A key names a pose
 * and any of: x, air (height above the ground), facing, weapon, opacity,
 * aura, weaponGlow, trail (whether a swing leaves a ribbon), and how to
 * ease into it. A key leaves out what does
 * not change; it carries on from the key before it.
 */
import { POSES } from './poses.mjs';
import { mix } from './rig.mjs';

const clamp01 = t => Math.min(1, Math.max(0, t));

export const EASE = {
  linear: t => t,
  in: t => t * t * t,
  out: t => 1 - (1 - t) ** 3,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  // Strikes: almost all the travel happens at once, then it settles.
  snap: t => 1 - (1 - t) ** 5,
  hold: t => (t < 1 ? 0 : 1),
};

const CARRIED = ['pose', 'x', 'air', 'facing', 'weapon', 'opacity', 'aura', 'auraColor', 'weaponGlow', 'breathe', 'trail'];

export class Track {
  constructor(id, initial) {
    this.id = id;
    this.keys = [{ t: 0, ease: 'linear', air: 0, facing: 1, weapon: false, opacity: 1, aura: 0, weaponGlow: 0, breathe: 0, trail: true, ...initial, pose: resolve(initial.pose ?? 'stand') }];
  }

  /** The key at or just before `t`. */
  before(t) {
    let found = this.keys[0];
    for (const key of this.keys) if (key.t <= t + 1e-9) found = key;
    return found;
  }

  /**
   * Add a key at `t`. `pose` is a pose name, a pose object, or null to keep
   * the pose. `dx` moves relative to the key before.
   */
  key(t, pose, options = {}) {
    const previous = this.before(t);
    const next = { t, ease: 'inOut', arc: 0 };
    for (const field of CARRIED) next[field] = previous[field];
    if (pose) next.pose = resolve(pose);
    const { dx, ...rest } = options;
    Object.assign(next, rest);
    if (options.pose) next.pose = resolve(options.pose);
    if (dx !== undefined) next.x = previous.x + dx;
    this.keys = this.keys.filter(key => Math.abs(key.t - t) > 1e-9);
    this.keys.push(next);
    this.keys.sort((a, b) => a.t - b.t);
    return this;
  }

  /** Keep everything as it is until `t`. */
  hold(t) {
    if (this.keys.some(key => Math.abs(key.t - t) < 1e-9)) return this;
    return this.key(t, null, { ease: 'linear' });
  }

  /** The figure's state at scene time `t`. */
  at(t) {
    const keys = this.keys;
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].t <= t) i += 1;
    const a = keys[i];
    const b = keys[i + 1];
    if (!b) return { ...a, pose: { ...a.pose } };
    const raw = clamp01((t - a.t) / (b.t - a.t || 1));
    const s = (EASE[b.ease] ?? EASE.inOut)(raw);
    const lerp = field => a[field] + (b[field] - a[field]) * s;
    // An arc lifts the figure in a parabola between the two keys, for jumps and throws.
    const arc = b.arc ? Math.sin(Math.PI * raw) * b.arc : 0;
    const moveS = b.moveEase ? EASE[b.moveEase](raw) : s;
    return {
      pose: mix(a.pose, b.pose, s),
      x: a.x + (b.x - a.x) * moveS,
      air: a.air + (b.air - a.air) * moveS + arc,
      facing: raw < 0.5 || b.ease === 'hold' ? a.facing : b.facing,
      weapon: raw >= 1 ? b.weapon : a.weapon,
      opacity: lerp('opacity'),
      aura: lerp('aura'),
      auraColor: b.auraColor ?? a.auraColor,
      weaponGlow: lerp('weaponGlow'),
      breathe: lerp('breathe'),
      trail: a.trail && b.trail,
    };
  }
}

function resolve(pose) {
  if (typeof pose === 'string') {
    if (!POSES[pose]) throw new Error(`No pose named "${pose}".`);
    return { ...POSES[pose] };
  }
  return { ...pose };
}

/** Blend a named pose with overrides, for keys that tweak a stock pose. */
export const P = (name, overrides = {}) => ({ ...POSES[name], ...overrides });

// Moves. Each writes keys onto a track from time `t` and returns the times
// that matter to the other figures, such as when a blow lands.

/** Run from where the figure is to `x`, arriving at `t1`. */
export function run(track, t0, t1, x, { stride = 0.13 } = {}) {
  const start = track.before(t0).x;
  track.hold(t0);
  const steps = Math.max(2, Math.round((t1 - t0) / stride));
  for (let i = 1; i <= steps; i += 1) {
    const t = t0 + ((t1 - t0) * i) / steps;
    track.key(t, i % 2 ? 'run1' : 'run2', { x: start + ((x - start) * i) / steps, ease: 'linear', moveEase: 'linear' });
  }
  return t1;
}

/** Wind up, strike and recover. Returns the moment of contact. */
export function strike(track, t, wind, hit, { windUp = 0.12, snap = 0.06, hold = 0.1, recover = null, recoverIn = 0.18, dx = 0, windDx = 0 } = {}) {
  track.hold(t);
  track.key(t + windUp, wind, { ease: 'out', dx: windDx });
  const contact = t + windUp + snap;
  track.key(contact, hit, { ease: 'snap', dx });
  track.hold(contact + hold);
  if (recover) track.key(contact + hold + recoverIn, recover, { ease: 'inOut' });
  return contact;
}

/** Take a blow: snap into a hurt pose, slide back, then recover. */
export function react(track, t, { pose = 'hurt', dx = -30, dur = 0.35, recover = 'stance' } = {}) {
  track.hold(t);
  track.key(t + 0.05, pose, { ease: 'snap', dx: dx * 0.6 });
  track.key(t + dur * 0.6, null, { ease: 'out', dx: dx * 0.4 });
  if (recover) track.key(t + dur, recover, { ease: 'inOut' });
  return t + dur;
}

/** Thrown through the air: lifts off, flies `dx`, lands flat on the back. */
export function launch(track, t, { dx = -250, peak = 120, flight = 0.5, downFor = 0.6, rise = true, risePose = 'stance' } = {}) {
  track.hold(t);
  track.key(t + 0.05, 'flung', { ease: 'snap', dx: dx * 0.1, air: peak * 0.3 });
  const land = t + flight;
  track.key(land, 'down', { ease: 'inOut', moveEase: 'out', dx: dx * 0.9, air: 0, arc: peak });
  track.key(land + 0.12, P('down', { rot: -86 }), { ease: 'out', dx: dx * 0.08 });
  if (rise) {
    track.hold(land + downFor);
    track.key(land + downFor + 0.25, 'rise', { ease: 'inOut' });
    track.key(land + downFor + 0.5, risePose, { ease: 'inOut' });
  }
  return land;
}

/** A jump from where the figure is to `x`, peaking `height` above the ground. */
export function jump(track, t, x, { height = 140, dur = 0.5, crouch = 0.08, airPose = 'tuck', land = 'crouch', after = 'stance' } = {}) {
  track.hold(t);
  track.key(t + crouch, 'crouch', { ease: 'out' });
  track.key(t + crouch + dur * 0.5, airPose, { ease: 'out', moveEase: 'linear', x: (track.before(t).x + x) / 2, air: height });
  track.key(t + crouch + dur, land, { ease: 'in', moveEase: 'linear', x, air: 0 });
  if (after) track.key(t + crouch + dur + 0.2, after, { ease: 'inOut' });
  return t + crouch + dur;
}

/** A short, fast step with no running cycle. */
export function dash(track, t, x, { dur = 0.18, pose = 'dash', arrive = null } = {}) {
  track.hold(t);
  track.key(t + dur, pose, { ease: 'out', x });
  if (arrive) track.key(t + dur + 0.08, arrive, { ease: 'out' });
  return t + dur;
}
