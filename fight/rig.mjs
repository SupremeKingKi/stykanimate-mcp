/**
 * The stick figure rig: a pose of joint angles, solved into points.
 *
 * Every figure is drawn facing right in its own space and mirrored when it
 * faces left. Angles are degrees. A bone's world angle is 0 pointing up and
 * grows clockwise, so 90 points forward and 180 points down.
 *
 *   lean    torso tilt from upright, forward is positive
 *   head    head tilt on top of the torso
 *   fs, bs  front and back shoulder: 0 hangs down, 90 points forward, 180 up
 *   fe, be  front and back elbow: 0 straight, positive curls the forearm up
 *   fh, bh  front and back hip: 0 straight down, positive swings the leg forward
 *   fk, bk  front and back knee: 0 straight, positive folds the shin back
 *   rot     the whole body spun around the hip, for flips and falls
 *   w       the weapon's angle against the front forearm
 */

export const POSE_KEYS = ['lean', 'head', 'fs', 'fe', 'bs', 'be', 'fh', 'fk', 'bh', 'bk', 'rot', 'w'];

export const NEUTRAL = { lean: 0, head: 0, fs: 10, fe: 10, bs: -10, be: 10, fh: 5, fk: 5, bh: -5, bk: 5, rot: 0, w: 0 };

/** Bone lengths of a figure of scale 1. */
export const BODY = { torso: 46, neck: 7, headR: 12, upper: 27, fore: 25, thigh: 33, shin: 33, foot: 9 };

const rad = degrees => (degrees * Math.PI) / 180;
const step = (from, angle, length) => ({
  x: from.x + Math.sin(rad(angle)) * length,
  y: from.y - Math.cos(rad(angle)) * length,
});

/**
 * Solve a pose into points around a hip at the origin, facing right.
 * Returns every joint and the world angle of every bone.
 */
export function solve(pose, scale = 1, body = BODY) {
  const b = Object.fromEntries(Object.entries(body).map(([key, value]) => [key, value * scale]));
  const p = { ...NEUTRAL, ...pose };
  const r = p.rot;
  const hip = { x: 0, y: 0 };
  const torsoA = p.lean + r;
  const chest = step(hip, torsoA, b.torso);
  const neckA = torsoA + p.head;
  const neck = step(chest, neckA, b.neck);
  const head = step(neck, neckA, b.headR);
  const limb = (shoulder, elbow) => {
    const upperA = torsoA + 180 - shoulder;
    const foreA = upperA - elbow;
    const e = step(chest, upperA, b.upper);
    return { elbow: e, hand: step(e, foreA, b.fore), upperA, foreA };
  };
  const leg = (hipFlex, knee) => {
    const thighA = r + 180 - hipFlex;
    const shinA = thighA + knee;
    const k = step(hip, thighA, b.thigh);
    const ankle = step(k, shinA, b.shin);
    return { knee: k, ankle, toe: step(ankle, shinA - 90, b.foot), thighA, shinA };
  };
  return {
    hip,
    chest,
    neck,
    head,
    headR: b.headR,
    neckA,
    torsoA,
    front: limb(p.fs, p.fe),
    back: limb(p.bs, p.be),
    frontLeg: leg(p.fh, p.fk),
    backLeg: leg(p.bh, p.bk),
    weaponA: limb(p.fs, p.fe).foreA + p.w,
  };
}

/** How far below the hip the lowest body point sits, so the figure can stand on the ground. */
export function lowestPoint(solved) {
  const points = [
    solved.frontLeg.knee, solved.frontLeg.ankle, solved.frontLeg.toe,
    solved.backLeg.knee, solved.backLeg.ankle, solved.backLeg.toe,
    solved.front.hand, solved.back.hand, solved.front.elbow, solved.back.elbow,
    solved.chest, solved.hip,
  ];
  let lowest = -Infinity;
  for (const point of points) lowest = Math.max(lowest, point.y);
  lowest = Math.max(lowest, solved.head.y + solved.headR);
  return lowest;
}

/** Blend two poses, `t` from 0 to 1. Missing keys fall back to the neutral pose. */
export function mix(a, b, t) {
  const out = {};
  for (const key of POSE_KEYS) {
    const from = a[key] ?? NEUTRAL[key];
    const to = b[key] ?? NEUTRAL[key];
    out[key] = from + (to - from) * t;
  }
  return out;
}

/** Move a local point (facing right, hip at origin) into the world. */
export function toWorld(point, { x, y, facing }) {
  return { x: x + point.x * facing, y: y + point.y };
}
