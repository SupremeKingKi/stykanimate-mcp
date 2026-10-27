/**
 * Foot locking: planted feet stay where they touched the floor.
 *
 * Keys say where the hips go and roughly how the legs bend. Played back as
 * they are, a foot on the floor slides whenever the hips move or the pose
 * changes. Here a grounded foot is pinned where it landed and the leg is
 * re-bent each frame (a two-bone solve of hip and knee) so the ankle stays
 * on that spot while the hips follow their keys. When the animation wants
 * the foot somewhere else, or the leg cannot reach any more, the foot takes
 * a quick step: it lifts in a small arc and plants again where it is wanted.
 */
import { BODY, solve } from './rig.mjs';
import { GROUND } from './stage.mjs';

const LEGS = [
  { side: 'frontLeg', hip: 'fh', knee: 'fk' },
  { side: 'backLeg', hip: 'bh', knee: 'bk' },
];

// How close to the floor (px) a foot must be to count as standing on it.
const FLOOR = 5;
// How far (px) the animation may pull a foot from its spot before it steps.
const SLIP = 40;
// How long a step takes (scene seconds) and how high the foot lifts.
const STEP_TIME = 0.1;
const LIFT = 10;

const rad = degrees => (degrees * Math.PI) / 180;
const deg = radians => (radians * 180) / Math.PI;
const wrap = degrees => ((((degrees + 180) % 360) + 360) % 360) - 180;
const smooth = u => u * u * (3 - 2 * u);

/**
 * Bend a leg so its ankle reaches `target`, given relative to the hip in the
 * figure's own space (facing right, y down). The knee bends forward, as a
 * knee does. Returns the hip and knee angles in the rig's terms.
 */
export function solveLeg(target, thigh, shin, rot = 0) {
  const reach = Math.max(Math.abs(thigh - shin) + 0.01, Math.min(Math.hypot(target.x, target.y), (thigh + shin) * 0.999));
  // World angles in the rig: 0 points up and they grow clockwise.
  const toward = deg(Math.atan2(target.x, -target.y));
  const cosHip = (thigh * thigh + reach * reach - shin * shin) / (2 * thigh * reach);
  const thighA = toward - deg(Math.acos(Math.max(-1, Math.min(1, cosHip))));
  const knee = { x: Math.sin(rad(thighA)) * thigh, y: -Math.cos(rad(thighA)) * thigh };
  const shinA = deg(Math.atan2(target.x - knee.x, -(target.y - knee.y)));
  return { hip: wrap(rot + 180 - thighA), knee: wrap(shinA - thighA) };
}

/** One figure's feet: where each is planted, and how much they have slid. */
export class FootLock {
  constructor({ enabled = true } = {}) {
    this.enabled = enabled;
    this.feet = { frontLeg: null, backLeg: null };
    this.previous = { frontLeg: null, backLeg: null };
    // Measures: how far planted feet slid along the floor, and how many steps were taken.
    this.skate = 0;
    this.steps = 0;
  }

  /** Pin planted feet for this frame by re-bending the legs in `state.pose`. */
  apply(state, scale, now) {
    const grounded = state.air < 1 && Math.abs(state.pose.rot ?? 0) < 25;
    const keyed = solve(state.pose, scale);
    const world = point => ({ x: state.x + point.x * state.facing, y: state.y + point.y });
    for (const leg of LEGS) {
      const ankle = world(keyed[leg.side].ankle);
      const toe = world(keyed[leg.side].toe);
      const onFloor = grounded && GROUND - Math.max(ankle.y, toe.y) < FLOOR;
      let lock = this.feet[leg.side];
      if (!this.enabled || !onFloor || (lock && lock.facing !== state.facing)) {
        this.feet[leg.side] = onFloor && this.enabled ? { x: ankle.x, y: ankle.y, facing: state.facing } : null;
        continue;
      }
      if (!lock) {
        this.feet[leg.side] = { x: ankle.x, y: ankle.y, facing: state.facing };
        continue;
      }
      // Pulled too far from its spot: step to where the animation wants it.
      if (!lock.step && Math.abs(ankle.x - lock.x) > SLIP) {
        lock.step = { x: lock.x, y: lock.y, start: now };
        this.steps += 1;
      }
      let target = { x: lock.x, y: lock.y };
      if (lock.step) {
        const progress = Math.min(1, (now - lock.step.start) / STEP_TIME);
        const e = smooth(progress);
        target = {
          x: lock.step.x + (ankle.x - lock.step.x) * e,
          y: lock.step.y + (ankle.y - lock.step.y) * e - Math.sin(Math.PI * progress) * LIFT,
        };
        if (progress >= 1) this.feet[leg.side] = lock = { x: ankle.x, y: ankle.y, facing: state.facing };
      }
      const local = { x: (target.x - state.x) * state.facing, y: target.y - state.y };
      const thigh = BODY.thigh * scale;
      const shin = BODY.shin * scale;
      // Out of reach even with the leg straight: let the foot go to where it is wanted.
      // A leg the keys already hold nearly straight (standing tall) is not overstretched.
      const keyedReach = Math.hypot(keyed[leg.side].ankle.x, keyed[leg.side].ankle.y);
      const reach = Math.hypot(local.x, local.y);
      if (reach > (thigh + shin) * 0.995 && reach > keyedReach + 3 && !lock.step) {
        lock.step = { x: lock.x, y: lock.y, start: now };
        this.steps += 1;
      }
      const bent = solveLeg(local, thigh, shin, state.pose.rot ?? 0);
      state.pose[leg.hip] = bent.hip;
      state.pose[leg.knee] = bent.knee;
    }
    this.measure(state, scale, grounded);
  }

  /** Add up how far each foot on the floor slid since the last frame (a step is not a slide). */
  measure(state, scale, grounded) {
    const drawn = solve(state.pose, scale);
    for (const leg of LEGS) {
      const ankle = { x: state.x + drawn[leg.side].ankle.x * state.facing, y: state.y + drawn[leg.side].ankle.y };
      const onFloor = grounded && GROUND - ankle.y < FLOOR + 6;
      const stepping = Boolean(this.feet[leg.side]?.step);
      const before = this.previous[leg.side];
      if (onFloor && before && !stepping) this.skate += Math.abs(ankle.x - before.x);
      this.previous[leg.side] = onFloor && !stepping ? ankle : null;
    }
  }
}
