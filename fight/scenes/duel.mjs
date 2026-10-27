/**
 * Kade vs Vorthak: a short one-on-one, kept small so the engine is easy to
 * see and to work on. Each exchange chains into the next instead of
 * resetting to a stance.
 *
 *   0.0  they square up; Kade closes in
 *   1.0  a blocked jab and cross; Kade ducks the claw, uppercuts, high-kicks
 *   2.5  Vorthak charges: a blocked backhand, a slam Kade jumps clear of, a counter-kick
 *   4.0  sword out: a parry, two cuts, and Vorthak throws him
 *   6.9  Vorthak charges again; Kade cuts through him
 */
import { Track, P, run, strike, react, launch, jump, dash } from '../timeline.mjs';
import { connect } from '../contacts.mjs';

export function build() {
  const K = new Track('kade', { pose: 'stance', x: 1100, facing: 1 });
  const V = new Track('vorthak', { pose: 'hunch', x: 1500, facing: -1, breathe: 1 });
  const events = [];
  const ev = (type, t, props = {}) => events.push({ type, t, ...props });
  const swing = (t, gain = 0.5) => ev('sfx', t - 0.04, { name: 'whoosh', gain });
  const rushBoost = (t, who) =>
    ev('sprite', t, { at: `${who}.hip`, oy: 30, ox: -20, name: 'rush-boost-clip', scale: 0.8, flip: -1, faceActor: true, additive: true, tint: who === 'vorthak' ? '#ff3048' : '#ffffff' });

  // 0.0 — They square up, and Kade closes the distance.
  K.hold(0.4);
  run(K, 0.4, 0.95, 1330);
  K.key(1.0, 'stance', { ease: 'out' });
  ev('dust', 0.95, { at: 'kade.foot', dir: 1, size: 0.6 });

  // 1.0 — Jab and cross, both blocked.
  V.key(0.95, 'block', { ease: 'out', breathe: 0 });
  for (const [t, wind, hit] of [[1.0, 'jabWind', 'jab'], [1.18, 'stance', 'cross']]) {
    const contact = strike(K, t, wind, hit, { windUp: 0.06, snap: 0.05, hold: 0.03 });
    swing(contact, 0.4);
    ev('impact', contact, { at: 'kade.fist', kind: 'block', size: 0.7 });
  }
  // Vorthak swipes back; Kade ducks under it...
  V.key(1.42, 'backhandWind', { ease: 'out' });
  V.key(1.55, 'clawSwipe', { ease: 'snap' });
  swing(1.55, 0.8);
  K.key(1.5, 'crouch', { ease: 'snap' });
  // ...comes up out of the duck with an uppercut, and rolls it into a high kick.
  const upper = strike(K, 1.62, 'upperWind', 'upper', { windUp: 0.05, snap: 0.06, hold: 0.04 });
  swing(upper, 0.7);
  ev('impact', upper, { at: 'vorthak.chest', kind: 'hit', size: 1 });
  ev('hitstop', upper, { dur: 0.05 });
  react(V, upper, { pose: 'hurt', dx: 30, dur: 0.18, recover: null });
  const kick = strike(K, upper + 0.07, 'kickChamber', 'highKick', { windUp: 0.08, snap: 0.05, hold: 0.06, windDx: 55 });
  swing(kick, 0.8);
  ev('impact', kick, { at: 'vorthak.chest', kind: 'heavy', size: 1.4 });
  ev('hitstop', kick, { dur: 0.08 });
  ev('shake', kick, { amount: 8, dur: 0.3 });
  ev('punch', kick, { amount: 0.08 });
  react(V, kick, { pose: 'hurt', dx: 70, dur: 0.5, recover: 'hunch' });
  K.key(kick + 0.35, 'stance');

  // 2.5 — Vorthak charges. Kade blocks the backhand and is shoved back.
  rushBoost(2.5, 'vorthak');
  swing(2.55, 0.7);
  V.key(2.62, 'dash', { ease: 'out', dx: -150 });
  V.key(2.68, 'backhandWind', { ease: 'out' });
  const backhand = 2.78;
  V.key(backhand, 'backhand', { ease: 'snap' });
  K.key(2.7, 'block', { ease: 'snap' });
  swing(backhand, 0.8);
  ev('impact', backhand, { at: 'vorthak.fist', kind: 'block', size: 1.1 });
  ev('hitstop', backhand, { dur: 0.05 });
  ev('shake', backhand, { amount: 6, dur: 0.2 });
  K.key(2.86, 'skid', { dx: -50, ease: 'out' });
  ev('dust', 2.82, { at: 'kade.foot', dir: -1, size: 0.8 });
  // The slam: Kade jumps back out of it and it hits the floor.
  V.key(3.04, 'smashWind', { ease: 'out' });
  const slam = 3.26;
  V.key(slam, 'smash', { ease: 'snap', dx: -60 });
  swing(slam, 0.9);
  jump(K, 2.88, K.before(2.88).x - 190, { height: 95, dur: 0.36, airPose: 'tuck', land: 'crouch', after: null });
  ev('impact', slam, { at: 'vorthak.fist', kind: 'dark', size: 1.4, contact: false });
  ev('crack', slam, { at: 'vorthak.fist', size: 1.1 });
  ev('sprite', slam, { at: 'vorthak.fist', ground: true, name: 'ground-dust-by-vamz', scale: 0.35 });
  ev('debris', slam, { at: 'vorthak.fist', count: 12 });
  ev('shake', slam, { amount: 12, dur: 0.4 });
  ev('sfx', slam, { name: 'boom', gain: 0.7 });
  V.hold(3.45);
  V.key(3.7, 'hunch');
  // Kade lands and comes straight back in with a dash kick.
  rushBoost(3.5, 'kade');
  dash(K, 3.5, V.before(3.5).x - 150, { dur: 0.16, pose: 'kickChamber' });
  const dashKick = 3.76;
  K.key(dashKick, 'kick', { ease: 'snap' });
  swing(dashKick, 0.8);
  ev('impact', dashKick, { at: 'vorthak.hip', kind: 'hit', size: 1.2 });
  ev('hitstop', dashKick, { dur: 0.05 });
  react(V, dashKick, { pose: 'hurtLow', dx: 50, dur: 0.4, recover: 'hunch' });
  K.key(4.0, 'stance');

  // 4.0 — Sword out. Kade parries the claw and cuts twice; Vorthak grabs him and throws him.
  K.key(4.22, 'drawSword', { ease: 'out', weapon: true });
  ev('sfx', 4.18, { name: 'slash', gain: 0.35 });
  K.key(4.42, 'swordReady');
  V.key(4.5, 'backhandWind', { ease: 'out' });
  const claw = 4.65;
  V.key(claw, 'clawSwipe', { ease: 'snap', dx: -80 });
  swing(claw, 0.8);
  K.key(claw - 0.03, P('swordReady', { fs: 100, fe: 40, w: -80 }), { ease: 'snap' });
  ev('impact', claw, { at: 'kade.tip', kind: 'clang', size: 1.3 });
  ev('hitstop', claw, { dur: 0.06 });
  const cut1 = strike(K, 4.72, 'slashWind', 'slash', { windUp: 0.08, snap: 0.05, hold: 0.04 });
  swing(cut1, 0.7);
  ev('impact', cut1, { at: 'vorthak.chest', kind: 'slash', size: 1.1 });
  react(V, cut1, { pose: 'hurt', dx: 25, dur: 0.2, recover: null });
  const cut2 = strike(K, cut1 + 0.08, 'slashLowWind', 'slashLow', { windUp: 0.07, snap: 0.05, hold: 0.05 });
  swing(cut2, 0.8);
  ev('impact', cut2, { at: 'vorthak.hip', kind: 'slash', size: 1.5 });
  ev('hitstop', cut2, { dur: 0.08 });
  ev('shake', cut2, { amount: 10, dur: 0.3 });
  ev('split', cut2, { amount: 6 });
  react(V, cut2, { pose: 'hurtLow', dx: 30, dur: 0.3, recover: null });
  V.key(cut2 + 0.42, 'catch', { ease: 'snap', dx: -70 });
  const toss = cut2 + 0.56;
  V.key(toss, 'throw', { ease: 'snap' });
  V.key(toss + 0.4, 'hunch', { aura: 0.5 });
  swing(toss, 0.9);
  ev('impact', toss, { at: 'kade.chest', kind: 'heavy', size: 1.4 });
  ev('hitstop', toss, { dur: 0.08 });
  ev('shake', toss, { amount: 10, dur: 0.3 });
  const lands = launch(K, toss, { dx: -300, peak: 120, flight: 0.55, downFor: 0.3, risePose: 'swordReady' });
  ev('dust', lands, { at: 'kade.hip', size: 1.2, count: 10 });
  ev('sprite', lands, { at: 'kade.hip', ground: true, name: 'ground-dust-by-vamz', scale: 0.3 });
  ev('sfx', lands, { name: 'land' });

  // 6.9 — Vorthak charges; Kade cuts through him in one stroke.
  K.key(6.9, 'sheathe', { weaponGlow: 1, ease: 'inOut', trail: false });
  ev('sfx', 6.8, { name: 'riser', gain: 0.8 });
  V.key(6.95, 'crouch', { ease: 'out' });
  const kadeX = K.before(6.9).x;
  V.key(7.32, 'dash', { x: kadeX + 210, ease: 'in' });
  ev('slowmo', 7.1, { dur: 0.2, scale: 0.25 });
  K.key(7.3, 'sheathe', { trail: true });
  const cut = 7.36;
  K.key(cut, 'dashCut', { x: kadeX + 520, ease: 'snap', moveEase: 'linear' });
  rushBoost(cut - 0.04, 'kade');
  ev('speedLines', cut - 0.05, { life: 0.4 });
  ev('flash', cut, { life: 0.2, strength: 0.8 });
  ev('impactFrames', cut, { count: 3 });
  ev('sfx', cut - 0.03, { name: 'slash', gain: 1.2 });
  ev('hitstop', cut + 0.02, { dur: 0.5 });
  const opens = cut + 0.06;
  ev('slashLine', opens, { at: 'vorthak.chest', from: [-90, -80], to: [90, 70], width: 9 });
  ev('impact', opens, { at: 'vorthak.chest', kind: 'slash', size: 2.2, contact: false });
  ev('split', opens, { amount: 12, dur: 0.4 });
  ev('shake', opens, { amount: 18, dur: 0.6 });
  ev('punch', opens, { amount: 0.18, dur: 0.5 });
  ev('sfx', opens, { name: 'braam', gain: 1.1 });
  ev('sfx', opens, { name: 'boom', gain: 0.9 });
  ev('hitstop', opens + 0.02, { dur: 0.12 });
  react(V, opens, { pose: 'hurtLow', dx: 0, dur: 0.4, recover: null });
  V.key(opens + 0.8, null, { aura: 0 });
  V.key(8.1, 'kneel', { ease: 'out' });
  V.key(8.7, 'down', { ease: 'in' });
  ev('dust', 8.7, { at: 'vorthak.hip', size: 1.6, count: 12 });
  ev('sfx', 8.7, { name: 'land' });
  K.key(7.95, 'sheathe', { weaponGlow: 0, trail: false });
  K.key(8.35, 'stand', { weapon: false });
  ev('sfx', 8.35, { name: 'block', gain: 0.4 });
  K.key(8.9, 'stand', { facing: -1 });

  const follow = ['kade', 'vorthak'];
  const camera = [
    { t: 0, follow, fit: [1.6, 2.2], bars: 0.6, fade: 1 },
    { t: 0.4, follow, fit: [1.6, 2.2], bars: 0.6 },
    { t: 6.9, follow, fit: [1.6, 2.2], bars: 0.6 },
    { t: 7.2, follow, fit: [2.0, 2.3], dim: 0.5, bars: 1 },
    { t: 7.45, follow, fit: [1.5, 2.0], dim: 0.2, bars: 0.7, ease: 'out' },
    { t: 9.2, follow, fit: [1.4, 1.8], bars: 1 },
    { t: 10.6, follow, fit: [1.4, 1.7], bars: 1, fade: 1 },
  ];

  const scene = {
    duration: 10.6,
    order: ['vorthak', 'kade'],
    tracks: { kade: K, vorthak: V },
    events,
    camera,
    music: {
      bpm: 150,
      sections: [
        { from: 0, to: 1, level: 1 },
        { from: 1, to: 6.9, level: 3 },
        { from: 6.9, to: 11, level: 0 },
      ],
    },
    overlay: title,
  };
  // Lunge strikers in so every blow lands on the body it hits.
  scene.contacts = connect(scene);
  return scene;
}

/** The title card over the last second and a half. */
function title(ctx, view, t) {
  const fadeIn = Math.min(1, Math.max(0, (t - 9.1) / 0.5));
  if (fadeIn <= 0) return;
  ctx.save();
  ctx.globalAlpha = fadeIn;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '64px Impact';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0d0b0e';
  ctx.strokeText('KADE  vs  VORTHAK', view.width / 2, view.height * 0.3);
  ctx.fillStyle = '#f3f3f7';
  ctx.fillText('KADE  vs  VORTHAK', view.width / 2, view.height * 0.3);
  ctx.restore();
}
