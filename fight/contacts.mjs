/**
 * Make blows connect. At every impact in a scene, measure the gap between
 * the striking fist, foot or blade and the nearest part of the body it hits,
 * and lunge the striker in by that much so the blow lands on the body
 * rather than in the air in front of it.
 *
 * A scene calls connect() at the end of build(). An impact marked
 * `contact: false` is left alone: a blade into the floor, a projectile, a
 * dash that cuts through, a blade caught in a hand.

 * fight/check-contacts.mjs reports what it did.
 */
import { Actor } from './characters.mjs';
import { lowestPoint, solve } from './rig.mjs';
import { GROUND } from './stage.mjs';

/** Every actor posed as the renderer would pose it at scene time `t`. */
export function poseAt(scene, t) {
  const actors = new Map();
  for (const id of scene.order) {
    const actor = new Actor(id);
    const state = scene.tracks[id].at(t);
    state.y = GROUND - lowestPoint(solve(state.pose, actor.scaleOf(state))) - state.air;
    state.vx = 0;
    actor.update(state, 1 / 30);
    actors.set(id, actor);
  }
  return actors;
}

const STRIKERS = ['fist', 'backFist', 'foot', 'backFoot', 'tip'];

/** The body of a figure as world-space segments, with how thick each one is drawn. */
function bodySegments(actor) {
  const s = actor.solved;
  const k = actor.scaleOf();
  const w = point => ({ x: actor.place.x + point.x * actor.place.facing, y: actor.place.y + point.y });
  const chains = [
    [[s.hip, s.chest], actor.look.torso * k],
    [[s.chest, s.neck], actor.look.limb * k],
    [[s.chest, s.front.elbow, s.front.hand], actor.look.limb * k],
    [[s.chest, s.back.elbow, s.back.hand], actor.look.limb * k],
    [[s.hip, s.frontLeg.knee, s.frontLeg.ankle], actor.look.limb * k],
    [[s.hip, s.backLeg.knee, s.backLeg.ankle], actor.look.limb * k],
  ];
  const segments = [];
  for (const [points, width] of chains) {
    for (let i = 1; i < points.length; i += 1) segments.push({ a: w(points[i - 1]), b: w(points[i]), r: width / 2 });
  }
  segments.push({ a: w(s.head), b: w(s.head), r: s.headR });
  return segments;
}

function distanceToSegment(p, { a, b }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The gap from a point to a figure's drawn body, in world pixels (negative means overlapping). */
export function gapTo(point, actor) {
  let best = Infinity;
  for (const segment of bodySegments(actor)) best = Math.min(best, distanceToSegment(point, segment) - segment.r);
  return best;
}

/**
 * Who struck whom, and how far apart the blow and the body were. The
 * striker is the figure named at the hit if it names a fist, foot or blade;
 * otherwise the other figure whose fist, foot or blade is nearest.
 */
export function measure(scene, event) {
  const actors = poseAt(scene, event.t);
  const [id, part] = event.at.split('.');
  const named = actors.get(id);
  const options = [];
  if (STRIKERS.includes(part)) {
    for (const [other, actor] of actors) if (other !== id) options.push({ by: named, part, target: actor });
  } else {
    for (const [other, actor] of actors) {
      if (other === id) continue;
      for (const strikerPart of STRIKERS) if (strikerPart !== 'tip' || actor.weaponLine()) options.push({ by: actor, part: strikerPart, target: named });
    }
  }
  let best = null;
  for (const option of options) {
    const gap = gapTo(option.by.point(option.part), option.target);
    if (!best || gap < best.gap) best = { ...option, gap };
  }
  return best && {
    t: event.t,
    by: best.by.id,
    part: best.part,
    target: best.target.id,
    dir: Math.sign(best.target.place.x - best.by.place.x) || best.by.place.facing,
    gap: Math.round(best.gap),
    kind: event.kind ?? 'hit',
  };
}

/**
 * Close the gap at every impact by lunging the striker toward its target,
 * a little past the surface so the blow reads as landing. Impacts are taken
 * in order, so each one is measured with the lunges before it in place.
 * Returns what each impact measured before and after.
 */
export function connect(scene, { overlap = 3, tolerance = 8, limit = 110 } = {}) {
  const report = [];
  for (const event of scene.events.filter(e => e.type === 'impact' && e.at && e.contact !== false).sort((a, b) => a.t - b.t)) {
    const before = measure(scene, event);
    if (!before) continue;
    let after = before;
    let moved = 0;
    for (let pass = 0; pass < 6 && after.gap > tolerance; pass += 1) {
      const step = Math.min(after.gap + overlap, limit - moved);
      if (step < 1) break;
      const { by } = after;
      // Usually the striker is short and steps in. A long weapon can overreach
      // instead, so if stepping in makes it worse, try stepping back.
      let improved = null;
      for (const dir of [after.dir, -after.dir]) {
        scene.tracks[by].addNudge(event.t, dir * step);
        const next = measure(scene, event);
        if (next.gap < after.gap) {
          improved = next;
          break;
        }
        scene.tracks[by].addNudge(event.t, -dir * step);
      }
      // A blow aimed over or under the body gets no closer either way; leave the pose to be fixed.
      if (!improved) break;
      moved += step;
      after = improved;
    }
    report.push({ before, after, moved: Math.round(moved) });
  }
  return report;
}
