/**
 * Kade vs Vorthak: a one-on-one that travels across the map. Each exchange
 * chains into the next instead of resetting to a stance.
 *
 * A 19.2-second intro plays first, storyboarded in intro(): a flashback to
 * Kade's first defeat, his training, the change, and his return. The fight's times below are written
 * from the start of the fight; build() moves them all later by the intro.
 *
 *   0.0  they square up; Kade closes in
 *   1.0  a blocked jab and cross; Kade ducks the claw, uppercuts, high-kicks
 *   2.5  Vorthak charges: a blocked backhand, a slam Kade jumps clear of, a counter-kick
 *   4.0  sword out: a parry, two cuts, and Vorthak throws him
 *   6.8  Kade drives him back across the hall and kicks him through a pillar
 *  10.9  Vorthak leaps over Kade and knocks him flying into the ruins
 *  13.5  he presses Kade back out onto the open terrace
 *  15.3  Vorthak charges one last time; Kade cuts through him
 *  17.2  part two (duel-part2.mjs): he rises as a demon of red lightning,
 *        and Kade finds ice
 */
import { Track, P, run, strike, react, launch, jump, dash } from '../timeline.mjs';
import { connect } from '../contacts.mjs';
import { syncToBeat } from '../beats.mjs';
import { partTwo } from './duel-part2.mjs';

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
  // Part two: he rises again as a demon of red lightning, and Kade finds ice.
  const two = partTwo({ K, V, ev, start: opens + 1.9 });
  const end = two.end;
  titleAt = two.titleAt;

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
    ...two.camera,
  ];
  // The fight fades in no longer: the intro plays first, and the whole fight moves later to follow it.
  delete camera[0].fade;
  delay([K, V], events, camera, INTRO);
  intro(K, V, ev, camera);
  titleAt += INTRO;

  const scene = {
    duration: end + INTRO,
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
      // at 121.625s, starts its strongest 23 seconds, so the fight plays from there; the intro takes
      // the twelve bars before it, from bar 64, and the song's beats fall every 0.4s from the first frame.
      bpm: 150,
      offset: 0,
      track: {
        file: 'fight/assets/music/Metalmania.mp3',
        start: 121.625 - INTRO,
        // Metalmania is mastered loud; this leaves the hits room on top.
        gain: 0.42,
        // Through the intro the song is faint for the flashback, builds through the training, swells
        // when Kade's colour ignites, sinks again for the return, and drops in when the fight starts.
        // It falls away once more under the last charge and crashes back in on the cut.
        duck: [
          { from: -1, to: 6.3, gain: 0.18 },
          { from: 6.4, to: 12.15, gain: 0.45 },
          { from: 12.8, to: INTRO - 0.15, gain: 0.3 },
          { from: last - 0.05 + INTRO, to: opens + INTRO, gain: 0.2 },
          ...two.ducks.map(d => ({ ...d, from: d.from + INTRO, to: d.to + INTRO })),
        ],
      },
      sections: [
        { from: 0, to: 1, level: 1 },
        { from: 1, to: 6.9, level: 3 },
        { from: 6.9, to: 11, level: 0 },
      ],
    },
    overlay: (ctx, view, t) => {
      caption(ctx, view, t);
      versusCard(ctx, view, t);
      title(ctx, view, t);
    },
  };
  // Lunge strikers in so every blow lands on the body it hits,
  // then bend the timing so every blow lands on the beat.
  scene.contacts = connect(scene);
  scene.beats = syncToBeat(scene);
  titleAt = scene.beats.warp(titleAt);
  cardAt = scene.beats.warp(CARD);
  captions = captions.map(([t, text]) => [scene.beats.warp(t), text]);
  scene.storyboard = [...STORYBOARD, ...two.storyboard.map(beat => ({ ...beat, t: beat.t + INTRO }))].map(beat => ({ ...beat, t: scene.beats.warp(beat.t) }));
  return scene;
}

/** How long the intro runs: twelve bars of the song, so the fight still starts on a bar. */
const INTRO = 19.2;
/** When the VS card slams in, in intro time: the start of the last bar. */
const CARD = 17.6;
/** Kade's colour before he finds his resolve: grey, where it will later be blue. */
const GREY = '#9aa0aa';

/** Move every key, effect and camera key of the fight later by `by` seconds. */
function delay(tracks, events, camera, by) {
  for (const track of tracks) for (const key of track.keys) key.t += by;
  for (const e of events) e.t += by;
  for (const key of camera) key.t += by;
}

/**
 * The intro, twelve bars, as storyboarded. Both characters change across it.
 *
 *   bar 1      ONE YEAR AGO. The hall, faded like an old film.
 *   bars 2-3   Kade, grey and reckless, charges with his sword. Vorthak does
 *              not even raise a guard, then swats him away one-handed.
 *   bar 4      Vorthak turns his back and walks off. Kade lies reaching after him.
 *   bar 5      Training, alone: slow, clumsy strikes; he stumbles.
 *   bar 6      The same combo, fast and on the beat.
 *   bar 7      Sword drills: clean cuts and a dash.
 *   bar 8      He kneels, breathes, and his colour ignites blue.
 *   bar 9      NOW. Vorthak kneels in the dark hall, bored.
 *   bar 10     Kade walks in, a step on every beat. Vorthak barely looks up.
 *   bar 11     Kade's aura flares; Vorthak's eyes flare back and he rises.
 *   bar 12     The VS card, the stare-down, and the fight.
 */
function intro(K, V, ev, camera) {
  const swing = (t, gain = 0.5) => ev('sfx', t - 0.04, { name: 'whoosh', gain });
  // A hard cut: the figure is simply somewhere else in the next shot.
  const cutTo = (track, t, pose, options) => track.key(t, pose, { ...options, ease: 'hold' });

  // Bars 1-3: a year ago. Kade charges; Vorthak shrugs him off.
  K.key(0, 'swordReady', { x: 950, facing: 1, weapon: true, signature: GREY });
  V.key(0, 'hunch', { x: 1500, facing: -1, breathe: 1, aura: 0, opacity: 1 });
  K.hold(1.6);
  run(K, 1.6, 2.15, 1360);
  for (const start of [2.2, 2.6]) {
    const t = strike(K, start, 'slashWind', P('slash', { fs: 90, w: -26 }), { windUp: 0.12, snap: 0.06, hold: 0.05 });
    swing(t, 0.6);
    // Vorthak does not so much as flinch.
    ev('impact', t, { at: 'kade.tip', kind: 'block', size: 0.7, recoil: false });
  }
  V.key(2.75, P('hunch', { head: -36 }), { ease: 'out' });
  ev('sfx', 2.75, { name: 'growl', gain: 0.45 });
  V.key(3.0, 'backhandWind', { ease: 'out' });
  const swat = 3.2;
  V.key(swat, 'backhand', { ease: 'snap' });
  swing(swat, 0.9);
  ev('impact', swat, { at: 'vorthak.fist', kind: 'heavy', size: 1.5 });
  ev('hitstop', swat, { dur: 0.1 });
  ev('shake', swat, { amount: 12, dur: 0.35 });
  const down = launch(K, swat, { dx: -380, peak: 110, flight: 0.6, rise: false });
  // His sword spins away and clatters on the stone.
  K.key(swat + 0.05, null, { weapon: false });
  ev('sfx', swat + 0.7, { name: 'clang', gain: 0.5 });
  ev('sparks', swat + 0.7, { x: 820, y: 556, count: 8, color: '#fff2c0', speed: 220, angle: -Math.PI / 2, spread: 1.2 });
  ev('dust', down, { at: 'kade.hip', size: 1.2, count: 10 });
  ev('sfx', down, { name: 'land' });
  // Bar 4: he turns his back and walks away; Kade reaches after him.
  V.key(3.6, 'hunch');
  V.key(4.5, 'taunt', { facing: 1 });
  V.key(4.95, 'walk1', { dx: 70 });
  V.key(5.4, 'walk2', { dx: 70 });
  V.key(5.85, 'walk1', { dx: 70 });
  V.key(6.3, 'walk2', { dx: 70 });
  K.key(4.9, P('down', { rot: -86, bs: 150, be: 10 }), { ease: 'inOut' });
  K.key(6.2, P('down', { rot: -86, bs: 120, be: 30 }), { ease: 'inOut' });

  // Bar 5: training, alone. Slow and clumsy; he stumbles.
  cutTo(V, 6.4, 'hunch', { x: 3400, opacity: 0, facing: -1 });
  cutTo(K, 6.4, 'stance', { x: 420, facing: 1, weapon: false, air: 0 });
  for (const [start, wind, hit] of [[6.5, 'jabWind', 'jab'], [6.9, 'stance', 'cross']]) swing(strike(K, start, wind, hit, { windUp: 0.2, snap: 0.1, hold: 0.08 }), 0.35);
  K.key(7.45, 'hurtLow', { dx: 25, ease: 'out' });
  K.key(7.9, 'stance');

  // Bar 6: the same combo, fast, on every eighth note.
  cutTo(K, 8.0, 'stance', { x: 700, facing: -1 });
  const combo = [['jabWind', 'jab'], ['stance', 'cross'], ['stance', 'hook'], ['kickChamber', 'highKick'], ['jabWind', 'jab'], ['stance', 'cross']];
  combo.forEach(([wind, hit], i) => {
    const t = 8.2 + i * 0.2;
    const windUp = hit === 'highKick' ? 0.08 : 0.06;
    strike(K, t - windUp - 0.05, wind, hit, { windUp, snap: 0.05, hold: 0.04 });
    swing(t, 0.45);
  });
  ev('dust', 8.8, { at: 'kade.foot', size: 0.8 });
  K.key(9.5, 'stance');

  // Bar 7: sword drills. Two clean cuts and a dash.
  cutTo(K, 9.6, 'swordReady', { x: 300, facing: 1, weapon: true });
  swing(strike(K, 9.87, 'slashWind', 'slash', { windUp: 0.08, snap: 0.05, hold: 0.05 }), 0.7);
  swing(strike(K, 10.27, 'slashLowWind', 'slashLow', { windUp: 0.08, snap: 0.05, hold: 0.05 }), 0.7);
  K.key(10.65, 'sheathe', { ease: 'out', trail: false });
  K.key(10.8, 'dashCut', { dx: 360, ease: 'snap', moveEase: 'linear', trail: true });
  ev('speedLines', 10.75, { life: 0.35 });
  ev('sfx', 10.77, { name: 'slash', gain: 0.9 });
  K.key(11.1, 'swordReady', { ease: 'out' });

  // Bar 8: he kneels and breathes, and his colour ignites.
  cutTo(K, 11.2, 'kneel', { x: 900, facing: 1, weapon: false, breathe: 0.8 });
  ev('sfx', 11.4, { name: 'powerUp', gain: 0.5 });
  K.key(12.0, P('kneel', { head: -16 }), { ease: 'out' });
  const ignite = 12.2;
  K.key(ignite, P('kneel', { head: -16 }), { signature: null, aura: 1, auraColor: '#3a9bff', breathe: 0 });
  ev('flash', ignite, { color: '120,180,255', life: 0.35, strength: 0.5 });
  ev('ring', ignite, { at: 'kade.chest', size: 2, color: 'rgba(80,160,255,', life: 0.6 });
  ev('sparks', ignite, { at: 'kade.chest', count: 18, color: '#9fd0ff', speed: 320 });
  ev('sfx', ignite, { name: 'braam', gain: 0.8 });
  ev('shake', ignite, { amount: 6, dur: 0.4 });
  ev('punch', ignite, { amount: 0.12, dur: 0.5 });
  K.key(12.55, 'stance', { aura: 0.5 });
  K.key(12.75, 'stance', { aura: 0 });

  // Bar 9: NOW. Vorthak waits in the dark hall, bored.
  cutTo(V, 12.8, 'kneel', { x: 1500, opacity: 1, facing: -1, breathe: 0.6, aura: 0 });
  cutTo(K, 12.8, 'stand', { x: 600, facing: 1, weapon: false, aura: 0, breathe: 0 });
  K.hold(14.4);

  // Bar 10: Kade walks in, a step on every beat. Vorthak barely looks up.
  for (let i = 0; i < 5; i += 1) {
    const t = 14.4 + (i + 1) * 0.4;
    K.key(t, i % 2 ? 'walk2' : 'walk1', { x: 600 + (i + 1) * 92, ease: 'linear', moveEase: 'linear' });
    ev('sfx', t, { name: 'step', gain: 0.9 });
  }
  V.key(15.2, P('kneel', { head: -6 }), { ease: 'out' });
  V.key(15.7, 'kneel', { ease: 'inOut' });

  // Bar 11: Kade's aura flares; Vorthak's eyes flare back and he rises, serious now.
  K.key(16.5, 'stand', { x: 1090 });
  K.key(16.8, 'stance', { x: 1100, aura: 0.8, auraColor: '#3a9bff', ease: 'snap' });
  ev('sfx', 16.75, { name: 'powerUp', gain: 0.35 });
  ev('ring', 16.8, { at: 'kade.chest', size: 1.4, color: 'rgba(80,160,255,', life: 0.5 });
  V.key(17.0, P('kneel', { head: -18 }), { ease: 'out', aura: 0.45 });
  ev('sfx', 16.95, { name: 'braam', gain: 0.6 });
  ev('sfx', 17.0, { name: 'growl', gain: 0.7 });
  ev('flash', 17.0, { color: '255,40,60', life: 0.4, strength: 0.2 });
  V.key(17.3, 'rise', { aura: 0.2 });
  V.key(17.8, 'hunch', { aura: 0, breathe: 1 });

  // Bar 12: the VS card slams in; they stare each other down.
  ev('sfx', CARD, { name: 'heavy', gain: 1 });
  ev('sfx', CARD, { name: 'boom', gain: 0.6 });
  ev('shake', CARD, { amount: 8, dur: 0.3 });
  ev('flash', CARD, { life: 0.15, strength: 0.4 });
  K.key(18.6, 'stance', { aura: 0 });

  // The camera, shot by shot. Each new shot is a hard cut.
  const shots = [
    { t: 0, x: 1230, zoom: 1.35, grade: 1, bars: 1, fade: 1 },
    { t: 0.7, x: 1230, zoom: 1.35, grade: 1, bars: 1 },
    { t: 1.6, follow: ['kade', 'vorthak'], fit: [1.4, 1.9], grade: 1, bars: 1 },
    // Wide enough to see Vorthak walk away from the man on the floor.
    { t: 4.8, follow: ['kade', 'vorthak'], fit: [1.2, 1.6], grade: 1, bars: 1 },
    { t: 6.0, follow: ['kade', 'vorthak'], fit: [1.2, 1.6], grade: 1, bars: 1, fade: 1 },
    { t: 6.4, follow: ['kade'], zoom: 1.8, dim: 0.3, bars: 0.8, cut: true },
    { t: 8.0, follow: ['kade'], zoom: 2.0, dim: 0.25, bars: 0.8, cut: true },
    { t: 9.6, follow: ['kade'], zoom: 1.6, dim: 0.2, bars: 0.8, cut: true },
    { t: 11.2, follow: ['kade'], zoom: 2.3, dim: 0.5, bars: 1, cut: true },
    { t: 12.6, follow: ['kade'], zoom: 2.3, dim: 0.2, bars: 1 },
    { t: 12.8, follow: ['vorthak'], zoom: 2.3, dim: 0.9, bars: 1, cut: true },
    { t: 14.4, follow: ['vorthak'], zoom: 2.2, dim: 0.8, bars: 1 },
    { t: 15.6, follow: ['kade', 'vorthak'], fit: [1.3, 1.6], dim: 0.35, bars: 0.8 },
    { t: 16.8, follow: ['kade', 'vorthak'], zoom: 1.5, dim: 0.15, bars: 0.8 },
    // A fixed zoom pushes in for the stare-down; a fit range only ever pulls back.
    { t: CARD, follow: ['kade', 'vorthak'], zoom: 2.0, bars: 1, ease: 'out' },
    { t: 18.8, follow: ['kade', 'vorthak'], zoom: 1.8, bars: 0.6 },
  ];
  // Hold each shot right up to its cut, so the camera does not drift toward the next one.
  // Every shot names its look in full, since a camera key leaves out what carries over.
  const full = shots.map(shot => ({ dim: 0, grade: 0, fade: 0, ...shot }));
  const keys = [];
  full.forEach((shot, i) => {
    if (shot.cut && i > 0) keys.push({ ...full[i - 1], t: shot.t - 0.001, cut: false });
    keys.push(shot);
  });
  camera.unshift(...keys);
}

/** The intro's storyboard: the moment each panel shows, in intro time. fight/storyboard.mjs draws it. */
const STORYBOARD = [
  { t: 0.9, title: 'One year ago', note: 'The hall, faded like an old film. Kade, grey and sword in hand, faces Vorthak.' },
  { t: 2.38, title: 'He charges', note: 'Kade cuts at him twice. Vorthak does not even raise a guard.' },
  { t: 3.25, title: 'One swat', note: 'A one-handed backhand sends Kade across the hall; his sword spins away.' },
  { t: 5.3, title: 'Turned away', note: 'Vorthak turns his back and walks off. Kade lies reaching after him.' },
  { t: 7.5, title: 'Training: clumsy', note: 'Alone in the hall. Slow strikes; he stumbles.' },
  { t: 8.8, title: 'Training: fast', note: 'The same combo, now on every eighth note.' },
  { t: 10.85, title: 'Training: the blade', note: 'Clean cuts and a dash. He has a sword again.' },
  { t: 12.3, title: 'He changes', note: 'Kneeling, he breathes; his colour ignites blue. The music swells.' },
  { t: 13.6, title: 'Now', note: 'Vorthak waits in the dark hall, bored.' },
  { t: 15.3, title: 'The return', note: 'Kade walks in, a step on every beat. Vorthak barely looks up.' },
  { t: 17.05, title: 'Taken seriously', note: "Kade's aura flares; Vorthak's eyes flare back and he rises." },
  { t: 18.0, title: 'Kade vs Vorthak', note: 'The VS card slams in on the bar. The fight begins.' },
];

/** On-screen captions, as [time, text]; build() moves them with the beat sync. */
let captions = [
  [0.3, 'ONE YEAR AGO'],
  [12.9, 'NOW'],
];

/** A caption in the lower left, fading in and out over a second and a half. */
function caption(ctx, view, t) {
  for (const [at, text] of captions) {
    const age = t - at;
    if (age < 0 || age > 1.5) continue;
    const alpha = Math.min(1, age / 0.25, (1.5 - age) / 0.35);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 30px Bahnschrift';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.fillStyle = '#f3f3f7';
    ctx.strokeText(text, 60, view.height - 100);
    ctx.fillText(text, 60, view.height - 100);
    ctx.restore();
  }
}

/** When the VS card slams in; build() moves it with the beat sync. */
let cardAt = CARD;

/**
 * The VS card: Kade's name on a blue panel sliding in from the left,
 * Vorthak's on a red one from the right, meeting on a slant, with VS
 * popping in between. It holds a moment, then both panels fly out.
 */
function versusCard(ctx, view, t) {
  const age = t - cardAt;
  if (age < 0 || age > 1.4) return;
  const { width: w, height: h } = view;
  const arrive = 1 - (1 - Math.min(1, age / 0.12)) ** 3;
  const leave = age > 1.15 ? Math.min(1, (age - 1.15) / 0.22) ** 2 : 0;
  const mid = h * 0.5;
  const band = 120;
  const slant = 60;
  const left = -w * (1 - arrive) - w * leave;
  const right = w * (1 - arrive) + w * leave;
  ctx.save();
  ctx.fillStyle = '#2f8cff';
  ctx.beginPath();
  ctx.moveTo(left - 60, mid - band / 2);
  ctx.lineTo(left + w / 2 + slant, mid - band / 2);
  ctx.lineTo(left + w / 2 - slant, mid + band / 2);
  ctx.lineTo(left - 60, mid + band / 2);
  ctx.fill();
  ctx.fillStyle = '#d4183a';
  ctx.beginPath();
  ctx.moveTo(right + w + 60, mid - band / 2);
  ctx.lineTo(right + w / 2 + slant + 10, mid - band / 2);
  ctx.lineTo(right + w / 2 - slant + 10, mid + band / 2);
  ctx.lineTo(right + w + 60, mid + band / 2);
  ctx.fill();
  ctx.font = '72px Impact';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0d0b0e';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.strokeText('KADE', left + w / 2 - 100, mid + 4);
  ctx.fillText('KADE', left + w / 2 - 100, mid + 4);
  ctx.textAlign = 'left';
  ctx.strokeText('VORTHAK', right + w / 2 + 110, mid + 4);
  ctx.fillText('VORTHAK', right + w / 2 + 110, mid + 4);
  // VS pops in large and settles, once the panels have met.
  if (age > 0.08) {
    const pop = 1 + Math.max(0, 0.25 - (age - 0.08)) * 3;
    ctx.globalAlpha = 1 - leave;
    ctx.translate(w / 2 + 5, mid + 4);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center';
    ctx.font = '96px Impact';
    ctx.lineWidth = 10;
    ctx.strokeText('VS', 0, 0);
    ctx.fillStyle = '#ffe066';
    ctx.fillText('VS', 0, 0);
  }
  ctx.restore();
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
  // The credits CC BY asks for: the music, and the two sound packs that need it.
  ctx.font = 'bold 19px Bahnschrift';
  ctx.lineWidth = 5;
  const credit = [
    'Music: "Metalmania" by Kevin MacLeod (incompetech.com)',
    'Licensed under Creative Commons: By Attribution 4.0 License',
    'Sound effects: "Ice & Electricity Magic" by qubodup and "Thunder, Very Close" by InspectorJ',
    '(CC-BY 3.0, via OpenGameArt.org); Kenney.nl and other CC0 packs',
  ];
  credit.forEach((line, i) => {
    const y = view.height * 0.3 + 56 + i * 26;
    ctx.strokeText(line, view.width / 2, y);
    ctx.fillText(line, view.width / 2, y);
  });
  ctx.restore();
}
