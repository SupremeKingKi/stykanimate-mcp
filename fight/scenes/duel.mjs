/**
 * Kade vs Vorthak: a short one-on-one, kept small so the engine is easy to
 * see and to work on. Each exchange chains into the next instead of
 * resetting to a stance.
 *
 *   0.0  they square up; Kade closes in
 *   1.0  a blocked jab and cross; Kade ducks the claw, uppercuts, high-kicks
 *   2.5  Vorthak charges: a blocked backhand, a slam Kade jumps clear of, a counter-kick
 *   4.0  sword out: a parry, two cuts, and Vorthak throws him
 *   6.8  Kade drives him back across the hall and kicks him through a pillar
 *  10.9  Vorthak leaps over Kade and knocks him flying into the ruins
 *  13.5  he presses Kade back out onto the open terrace
 *  15.3  Vorthak charges one last time; Kade cuts through him
 */
import { Track, P, run, strike, react, launch, jump, dash } from '../timeline.mjs';
import { connect } from '../contacts.mjs';
import { syncToBeat } from '../beats.mjs';

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
  ev('sfx', 4.18, { name: 'draw', gain: 0.8 });
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

  // 6.8 — Kade drives Vorthak back across the hall, into a pillar.
  const pillarX = 1900;
  rushBoost(6.75, 'kade');
  run(K, 6.75, 7.2, V.before(6.75).x - 120);
  V.key(7.12, 'block', { ease: 'snap' });
  // A cut, blocked; Vorthak gives ground.
  // The blade meets him level, mid-swing, then follows through down.
  const push1 = strike(K, 7.2, 'slashWind', P('slash', { fs: 90, w: -26 }), { windUp: 0.08, snap: 0.05, hold: 0.03 });
  K.key(push1 + 0.1, 'slash', { ease: 'out' });
  swing(push1, 0.7);
  ev('impact', push1, { at: 'kade.tip', kind: 'clang', size: 1.1 });
  V.key(push1 + 0.18, 'block', { dx: 70, ease: 'out' });
  ev('dust', push1 + 0.05, { at: 'vorthak.foot', dir: 1, size: 0.7 });
  // Kade follows him in with a low cut; blocked again.
  const push2 = strike(K, push1 + 0.2, 'slashLowWind', 'slashLow', { windUp: 0.07, snap: 0.05, hold: 0.04, windDx: 60 });
  swing(push2, 0.7);
  ev('impact', push2, { at: 'kade.tip', kind: 'clang', size: 1 });
  V.key(push2 + 0.18, 'block', { dx: 60, ease: 'out' });
  // Vorthak swipes back; Kade ducks it and comes up with a rising cut...
  V.key(push2 + 0.25, 'backhandWind', { ease: 'out' });
  V.key(push2 + 0.38, 'clawSwipe', { ease: 'snap' });
  swing(push2 + 0.38, 0.8);
  K.key(push2 + 0.34, 'crouch', { ease: 'snap' });
  const rising = strike(K, push2 + 0.45, 'slashLowWind', P('upper', { w: -20 }), { windUp: 0.05, snap: 0.06, hold: 0.05, windDx: 70 });
  swing(rising, 0.7);
  ev('impact', rising, { at: 'vorthak.chest', kind: 'slash', size: 1.2 });
  react(V, rising, { pose: 'hurt', dx: 40, dur: 0.22, recover: null });
  // ...and a stepping high kick that sends him into the pillar.
  const spin = strike(K, rising + 0.08, 'kickChamber', 'highKick', { windUp: 0.08, snap: 0.05, hold: 0.07, windDx: 50 });
  swing(spin, 0.9);
  ev('impact', spin, { at: 'vorthak.chest', kind: 'heavy', size: 1.6 });
  ev('hitstop', spin, { dur: 0.1 });
  ev('shake', spin, { amount: 12, dur: 0.3 });
  ev('punch', spin, { amount: 0.1 });
  V.hold(spin);
  V.key(spin + 0.05, 'flung', { ease: 'snap', dx: 30, air: 40 });
  const crash = spin + 0.3;
  V.key(crash, P('flung', { rot: -10 }), { x: pillarX - 45, air: 30, ease: 'linear' });
  ev('breakPillar', crash, { x: pillarX });
  ev('impact', crash, { at: 'vorthak.chest', kind: 'heavy', size: 1.7, contact: false });
  ev('debris', crash, { x: pillarX, count: 26, size: 1.3 });
  ev('dust', crash, { x: pillarX, size: 2, count: 16 });
  ev('sprite', crash, { x: pillarX, y: 560, name: 'ground-dust-by-vamz', scale: 0.45 });
  ev('shake', crash, { amount: 18, dur: 0.6 });
  ev('tilt', crash, { angle: 4, dur: 0.6 });
  ev('impactFrames', crash, { count: 2 });
  ev('hitstop', crash, { dur: 0.1 });
  ev('sfx', crash, { name: 'boom', gain: 1 });
  ev('dust', crash + 0.5, { x: pillarX + 160, size: 1.6, count: 12 });
  ev('sfx', crash + 0.5, { name: 'land', gain: 1 });
  V.key(crash + 0.25, 'kneel', { air: 0, ease: 'in', dx: 20 });
  V.hold(crash + 1.0);
  K.key(spin + 0.35, 'swordReady');
  // Kade walks up on him while he is down.
  K.key(crash + 0.6, 'walk1', { x: pillarX - 360 });
  K.key(crash + 0.95, 'walk2', { x: pillarX - 290 });
  K.key(crash + 1.2, 'swordReady', { x: pillarX - 250 });
  // Vorthak rises out of the rubble in a rage.
  ev('sfx', crash + 1.0, { name: 'powerUp', gain: 0.7 });
  V.key(crash + 1.3, 'rise', { aura: 1 });
  const rage = crash + 1.7;
  V.key(rage, 'roar', { ease: 'snap', aura: 1.1 });
  ev('sfx', rage - 0.08, { name: 'roar', gain: 1.2 });
  ev('flash', rage, { color: '255,40,60', life: 0.35, strength: 0.5 });
  ev('ring', rage, { at: 'vorthak.chest', size: 2.2, color: 'rgba(255,40,70,', life: 0.6 });
  ev('shake', rage, { amount: 14, dur: 0.6 });
  ev('dust', rage, { at: 'vorthak.foot', size: 1.4, count: 12 });
  K.key(rage + 0.05, 'block', { dx: -50, ease: 'out' });
  K.key(rage + 0.45, 'swordReady');
  V.key(rage + 0.5, 'hunch', { aura: 1 });

  // Vorthak leaps over Kade, turning in the air, and knocks him flying into the ruins.
  const leap = rage + 0.6;
  swing(leap + 0.1, 0.8);
  jump(V, leap, K.before(leap).x - 150, { height: 210, dur: 0.5, airPose: 'tuck', land: 'crouch', after: null });
  V.key(leap + 0.34, null, { facing: 1 });
  // The landing key was written before the turn, so it has to be told too.
  V.key(leap + 0.58, null, { facing: 1 });
  K.key(leap + 0.45, null, { facing: -1 });
  const touchdown = leap + 0.58;
  ev('dust', touchdown, { at: 'vorthak.foot', size: 1.2 });
  ev('sfx', touchdown, { name: 'land', gain: 0.9 });
  V.key(touchdown + 0.1, 'backhandWind', { ease: 'out' });
  const smack = touchdown + 0.22;
  V.key(smack, 'backhand', { ease: 'snap' });
  K.key(smack - 0.08, 'block', { ease: 'snap' });
  swing(smack, 1);
  ev('impact', smack, { at: 'vorthak.fist', kind: 'heavy', size: 1.8 });
  ev('hitstop', smack, { dur: 0.12 });
  ev('shake', smack, { amount: 16, dur: 0.5 });
  ev('punch', smack, { amount: 0.15 });
  ev('tilt', smack, { angle: -5, dur: 0.7 });
  ev('split', smack, { amount: 8 });
  ev('impactFrames', smack, { count: 2 });
  const kadeLands = launch(K, smack, { dx: 560, peak: 160, flight: 0.85, downFor: 0.35, risePose: 'swordReady' });
  ev('dust', kadeLands, { at: 'kade.hip', size: 1.4, count: 12 });
  ev('sprite', kadeLands, { at: 'kade.hip', ground: true, name: 'ground-dust-by-vamz', scale: 0.35 });
  ev('sfx', kadeLands, { name: 'land' });
  V.key(smack + 0.3, 'hunch', { aura: 1 });
  run(V, smack + 0.35, kadeLands + 0.5, K.before(kadeLands).x - 130);

  // Vorthak presses; Kade blocks twice and gives ground, then rolls clear of a slam onto the terrace.
  const press = kadeLands + 0.9;
  V.key(press, 'backhandWind', { ease: 'out' });
  const strike1 = press + 0.12;
  V.key(strike1, 'clawSwipe', { ease: 'snap', dx: 40 });
  K.key(strike1 - 0.05, 'block', { ease: 'snap' });
  swing(strike1, 0.8);
  ev('impact', strike1, { at: 'vorthak.fist', kind: 'block', size: 1 });
  K.key(strike1 + 0.15, 'skid', { dx: 70, ease: 'out' });
  ev('dust', strike1 + 0.05, { at: 'kade.foot', dir: 1, size: 0.7 });
  V.key(strike1 + 0.25, 'backhandWind', { ease: 'out' });
  const strike2 = strike1 + 0.35;
  V.key(strike2, 'backhand', { ease: 'snap', dx: 50 });
  K.key(strike2 - 0.05, 'block', { ease: 'snap' });
  swing(strike2, 0.8);
  ev('impact', strike2, { at: 'vorthak.fist', kind: 'block', size: 1.1 });
  K.key(strike2 + 0.15, 'skid', { dx: 80, ease: 'out' });
  ev('dust', strike2 + 0.05, { at: 'kade.foot', dir: 1, size: 0.8 });
  V.key(strike2 + 0.3, 'smashWind', { ease: 'out' });
  const slam2 = strike2 + 0.5;
  V.key(slam2, 'smash', { ease: 'snap', dx: 60 });
  swing(slam2, 0.9);
  jump(K, strike2 + 0.25, K.before(strike2 + 0.25).x + 300, { height: 90, dur: 0.4, airPose: 'tuck', land: 'crouch', after: 'swordReady' });
  ev('impact', slam2, { at: 'vorthak.fist', kind: 'dark', size: 1.4, contact: false });
  ev('crack', slam2, { at: 'vorthak.fist', size: 1.1 });
  ev('sprite', slam2, { at: 'vorthak.fist', ground: true, name: 'ground-dust-by-vamz', scale: 0.35 });
  ev('debris', slam2, { at: 'vorthak.fist', count: 12 });
  ev('shake', slam2, { amount: 12, dur: 0.4 });
  ev('sfx', slam2, { name: 'boom', gain: 0.7 });
  V.key(slam2 + 0.3, 'hunch');

  // On the terrace: Vorthak charges, and Kade cuts through him in one stroke.
  const last = slam2 + 0.6;
  K.key(last, 'sheathe', { weaponGlow: 1, ease: 'inOut', trail: false });
  ev('sfx', last - 0.1, { name: 'riser', gain: 0.8 });
  V.key(last + 0.05, 'crouch', { ease: 'out' });
  const kadeX = K.before(last).x;
  V.key(last + 0.42, 'dash', { x: kadeX - 180, ease: 'in' });
  ev('slowmo', last + 0.2, { dur: 0.2, scale: 0.25 });
  K.key(last + 0.4, 'sheathe', { trail: true });
  const cut = last + 0.46;
  K.key(cut, 'dashCut', { x: kadeX - 520, ease: 'snap', moveEase: 'linear' });
  rushBoost(cut - 0.04, 'kade');
  ev('speedLines', cut - 0.05, { life: 0.4, dir: -1 });
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
  V.key(opens + 0.75, 'kneel', { ease: 'out' });
  V.key(opens + 1.35, 'down', { ease: 'in' });
  ev('dust', opens + 1.35, { at: 'vorthak.hip', size: 1.6, count: 12 });
  ev('sfx', opens + 1.35, { name: 'land' });
  K.key(opens + 0.6, 'sheathe', { weaponGlow: 0, trail: false });
  K.key(opens + 1.0, 'stand', { weapon: false });
  ev('sfx', opens + 1.0, { name: 'block', gain: 0.4 });
  K.key(opens + 1.55, 'stand', { facing: 1 });
  const end = opens + 4.2;
  titleAt = opens + 1.8;

  const follow = ['kade', 'vorthak'];
  const camera = [
    { t: 0, follow, fit: [1.6, 2.2], bars: 0.6, fade: 1 },
    { t: 0.4, follow, fit: [1.6, 2.2], bars: 0.6 },
    { t: crash - 0.1, follow, fit: [1.5, 2.2], bars: 0.6 },
    { t: smack, follow, fit: [1.2, 2.0], bars: 0.6 },
    { t: last, follow, fit: [1.6, 2.2], bars: 0.6 },
    { t: last + 0.3, follow, fit: [2.0, 2.3], dim: 0.5, bars: 1 },
    { t: opens + 0.03, follow, fit: [1.5, 2.0], dim: 0.2, bars: 0.7, ease: 'out' },
    { t: opens + 1.8, follow, fit: [1.2, 1.5], bars: 1 },
    { t: end - 0.6, follow, fit: [1.15, 1.4], bars: 1 },
    { t: end, follow, fit: [1.15, 1.4], bars: 1, fade: 1 },
  ];

  const scene = {
    duration: end,
    // The fight travels: the hall wall crumbles from x 1950 and opens onto a terrace past 2350,
    // and a pillar stands in the fighters' own plane where Kade kicks Vorthak into it.
    stage: { layout: { ruin: [1950, 2350] }, pillars: [pillarX] },
    order: ['vorthak', 'kade'],
    tracks: { kade: K, vorthak: V },
    events,
    camera,
    music: {
      // "Metalmania" by Kevin MacLeod (incompetech.com, CC BY 4.0). fight/music.mjs measures it at
      // 150 bpm with bars every 1.6s from 0.025s; its snare lands within 2ms of that grid. Bar 76,
      // at 121.625s, starts its strongest 23 seconds, so the duel plays from there and the song's
      // beats fall every 0.4s from the first frame.
      bpm: 150,
      offset: 0,
      track: {
        file: 'fight/assets/music/Metalmania.mp3',
        start: 121.625,
        // Metalmania is mastered loud; this leaves the hits room on top.
        gain: 0.42,
        // The song drops away under the last charge and crashes back in on the cut.
        duck: [{ from: last - 0.05, to: opens, gain: 0.2 }],
      },
      sections: [
        { from: 0, to: 1, level: 1 },
        { from: 1, to: 6.9, level: 3 },
        { from: 6.9, to: 11, level: 0 },
      ],
    },
    overlay: title,
  };
  // Lunge strikers in so every blow lands on the body it hits,
  // then bend the timing so every blow lands on the beat.
  scene.contacts = connect(scene);
  scene.beats = syncToBeat(scene);
  titleAt = scene.beats.warp(titleAt);
  return scene;
}

/** When the title card fades in; build() sets it and moves it with the beat sync. */
let titleAt = 0;

/** The title card and music credit over the last two and a half seconds. */
function title(ctx, view, t) {
  const fadeIn = Math.min(1, Math.max(0, (t - titleAt) / 0.5));
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
  // The music credit CC BY asks for.
  ctx.font = 'bold 19px Bahnschrift';
  ctx.lineWidth = 5;
  const credit = ['Music: "Metalmania" by Kevin MacLeod (incompetech.com)', 'Licensed under Creative Commons: By Attribution 4.0 License'];
  credit.forEach((line, i) => {
    const y = view.height * 0.3 + 56 + i * 26;
    ctx.strokeText(line, view.width / 2, y);
    ctx.fillText(line, view.width / 2, y);
  });
  ctx.restore();
}
