/**
 * Kade & Sora vs Vorthak: two fighters take on a horned brute in a stone hall.
 *
 * Times are scene seconds. Kade fights bare-handed, then with a katana;
 * Sora carries a scythe; Vorthak fights with claws and power.
 *
 *   0.0  the hall, Vorthak waiting; Kade and Sora run in
 *   6.6  Kade's rush, blocked, and the backhand that sends him flying
 *   7.9  Sora's leap, a miss, a parry, two clean hits; Vorthak roars
 *  13.0  the double attack; Vorthak catches the blade and throws Kade into Sora
 *  15.4  Vorthak powers up
 *  18.1  uppercut and slam on Kade; Sora's energy wave
 *  21.75 the clash, held in slow motion, until Kade breaks through
 *  22.7  the juggle: launched, slashed in the air, dived into a crater
 *  24.9  Vorthak rises in a rage
 *  26.3  the finisher: both cross through him at once
 *  28.7  the end
 */
import { Track, P, run, strike, react, launch, jump, dash } from '../timeline.mjs';

export function build() {
  const K = new Track('kade', { pose: 'stand', x: 150, facing: 1 });
  const S = new Track('sora', { pose: 'stand', x: 60, facing: 1, weapon: true });
  const V = new Track('vorthak', { pose: 'hunch', x: 1700, facing: -1, breathe: 1 });
  const events = [];
  const ev = (type, t, props = {}) => events.push({ type, t, ...props });
  const say = (t, dur, who, text, color) => ev('say', t, { dur, who, text, color });
  const swing = (t, gain = 0.5) => ev('sfx', t - 0.04, { name: 'whoosh', gain });
  // A flare of thrust behind a figure bursting forward (a StykAnimate library clip).
  const rushBoost = (t, who) =>
    ev('sprite', t, { at: `${who}.hip`, oy: 30, ox: -20, name: 'rush-boost-clip', scale: 0.8, flip: -1, faceActor: true, additive: true, tint: { sora: '#c9a6ff', vorthak: '#ff3048' }[who] ?? '#ffffff' });
  // Something driven into the floor: a crater, a ring of dust and stone, a jolt.
  const slam = (t, who, size = 1) => {
    ev('crack', t, { at: `${who}.hip`, size, crater: true });
    ev('sprite', t, { at: `${who}.hip`, ground: true, name: 'ground-dust-by-vamz', scale: 0.4 * size });
    ev('debris', t, { at: `${who}.hip`, count: Math.round(16 * size), size });
    ev('dust', t, { at: `${who}.hip`, size: 1.4 * size, count: 16 });
    ev('ring', t, { at: `${who}.hip`, oy: 14, size, squash: 0.22, life: 0.45 });
    ev('shake', t, { amount: 14 * size, dur: 0.7 });
    ev('impactFrames', t, { count: 2 });
    ev('hitstop', t, { dur: 0.1 });
    ev('sfx', t, { name: 'heavy', gain: 1.2 });
    ev('sfx', t, { name: 'land' });
    ev('sfx', t, { name: 'boom', gain: 0.8 });
  };

  // 0.0 — The hall. Vorthak waits; the other two run in.
  V.key(0.8, 'taunt', { breathe: 0.4 });
  say(0.8, 2.0, 'vorthak', 'More challengers... how tiresome.', '#3a0a10');
  V.key(2.4, 'hunch', { breathe: 1 });
  run(K, 0.9, 2.7, 1250);
  K.key(2.95, 'skid', { dx: 40, ease: 'out' });
  ev('dust', 2.75, { at: 'kade.foot', dir: 1, size: 0.8 });
  ev('sfx', 2.72, { name: 'step', gain: 0.8 });
  K.key(3.3, 'stance');
  run(S, 1.1, 2.9, 1130);
  S.key(3.15, 'skid', { dx: 30, ease: 'out' });
  ev('dust', 2.95, { at: 'sora.foot', dir: 1, size: 0.7 });
  S.key(3.5, 'scytheReady');
  say(3.5, 1.6, 'kade', "You're the one they call unbeatable?");
  V.key(5.0, 'taunt', { breathe: 0.3 });
  say(5.1, 1.5, 'vorthak', 'Come and find out.', '#3a0a10');
  V.key(6.4, 'hunch', { breathe: 1 });

  // 6.6 — Kade rushes in. Every blow is blocked.
  swing(6.6, 0.7);
  rushBoost(6.6, 'kade');
  dash(K, 6.6, 1590, { dur: 0.16, arrive: 'stance' });
  V.key(6.78, 'block', { ease: 'snap', breathe: 0 });
  const blows = [
    strike(K, 6.84, 'jabWind', 'jab', { windUp: 0.06, snap: 0.05, hold: 0.04 }),
    strike(K, 6.99, 'stance', 'cross', { windUp: 0.06, snap: 0.05, hold: 0.04 }),
    strike(K, 7.14, 'stance', 'hook', { windUp: 0.07, snap: 0.05, hold: 0.04 }),
  ];
  for (const t of blows) {
    swing(t, 0.35);
    ev('impact', t, { at: 'kade.fist', kind: 'block', size: 0.7 });
  }
  const kick = strike(K, 7.3, 'kickChamber', 'kick', { windUp: 0.09, snap: 0.05, hold: 0.08 });
  swing(kick);
  ev('impact', kick, { at: 'kade.foot', kind: 'block', size: 1 });
  V.key(kick + 0.05, null, { dx: 14, ease: 'out' });
  K.key(7.58, 'stance');
  // The backhand.
  V.key(7.55, 'backhandWind', { ease: 'out' });
  const backhand = 7.66;
  V.key(backhand, 'backhand', { ease: 'snap' });
  swing(backhand, 0.8);
  ev('impact', backhand, { at: 'vorthak.fist', kind: 'heavy', size: 1.5 });
  ev('hitstop', backhand, { dur: 0.1 });
  ev('shake', backhand, { amount: 12, dur: 0.35 });
  V.hold(7.85);
  V.key(8.2, 'hunch', { breathe: 0.6 });
  const kadeLands = launch(K, backhand, { dx: -330, peak: 90, flight: 0.5, downFor: 0.35, risePose: 'stance' });
  ev('dust', kadeLands, { at: 'kade.hip', size: 1.2, count: 10 });
  ev('sprite', kadeLands, { at: 'kade.hip', ground: true, name: 'ground-dust-by-vamz', scale: 0.3 });
  ev('sfx', kadeLands, { name: 'land' });

  // 7.9 — Sora leaps in. Vorthak slips the chop.
  const chopLands = jump(S, 7.9, 1520, { height: 170, dur: 0.55, airPose: 'scytheRaise', land: 'scytheChop', after: null });
  swing(chopLands - 0.08, 0.7);
  V.key(8.3, 'crouch', { ease: 'out', breathe: 0 });
  V.key(8.48, 'hunch', { dx: 160, arc: 40, ease: 'out' });
  ev('impact', chopLands, { at: 'sora.tip', kind: 'clang', size: 0.8, angle: -Math.PI / 2 });
  ev('dust', chopLands, { at: 'sora.tip', size: 0.8 });
  ev('shake', chopLands, { amount: 5, dur: 0.2 });
  S.key(8.75, 'scytheReady');
  // Vorthak's counter, parried.
  V.key(8.95, 'backhandWind', { dx: -120, ease: 'out' });
  V.key(9.05, 'clawSwipe', { ease: 'snap', dx: -100 });
  swing(9.05, 0.7);
  S.key(9.0, 'block', { ease: 'snap' });
  ev('impact', 9.05, { at: 'vorthak.fist', kind: 'clang', size: 1.1 });
  ev('hitstop', 9.05, { dur: 0.05 });
  S.key(9.15, null, { dx: -50, ease: 'out' });
  // Sora answers: a sweep, then a chop.
  S.key(9.25, 'scytheSweepWind', { ease: 'out' });
  S.key(9.37, 'scytheSweep', { ease: 'snap', dx: 30 });
  swing(9.37, 0.8);
  ev('impact', 9.37, { at: 'vorthak.chest', kind: 'purple', size: 1.3 });
  ev('hitstop', 9.37, { dur: 0.07 });
  ev('shake', 9.37, { amount: 8, dur: 0.25 });
  react(V, 9.37, { pose: 'hurt', dx: 50, dur: 0.28, recover: null });
  S.key(9.55, 'scytheRaise', { ease: 'out', dx: 20 });
  S.key(9.68, 'scytheChop', { ease: 'snap', dx: 30 });
  swing(9.68, 0.8);
  ev('impact', 9.68, { at: 'vorthak.chest', kind: 'purple', size: 1.6, gain: 1.2 });
  ev('hitstop', 9.68, { dur: 0.1 });
  ev('shake', 9.68, { amount: 12, dur: 0.3 });
  react(V, 9.68, { pose: 'hurtLow', dx: 70, dur: 0.6, recover: 'hunch' });
  S.key(9.95, 'scytheReady');
  S.key(10.3, 'scytheReady', { dx: -60 });
  // Kade gets up and draws his sword.
  K.key(9.6, 'drawSword', { ease: 'out', weapon: true });
  ev('sfx', 9.55, { name: 'slash', gain: 0.35 });
  K.key(9.9, 'swordReady');
  // The roar pushes both back.
  ev('sfx', 10.4, { name: 'roar', gain: 1.1 });
  V.key(10.55, 'roar', { ease: 'out' });
  ev('ring', 10.55, { at: 'vorthak.head', size: 1.6, life: 0.6, squash: 0.8 });
  ev('shake', 10.55, { amount: 9, dur: 0.8 });
  ev('dust', 10.6, { at: 'kade.foot', dir: -1 });
  ev('dust', 10.6, { at: 'sora.foot', dir: -1 });
  for (const track of [K, S]) {
    track.key(10.6, 'block', { ease: 'out' });
    track.key(10.95, null, { dx: -65, ease: 'out' });
  }
  K.key(11.2, 'swordReady');
  S.key(11.2, 'scytheReady');
  V.hold(11.3);
  V.key(11.6, 'hunch', { breathe: 0.8 });
  say(11.5, 1.5, 'vorthak', "Good. Now I'm interested.", '#3a0a10');

  // 13.0 — The double attack. Vorthak catches the blade and throws Kade into Sora.
  swing(13.0, 0.8);
  rushBoost(13.0, 'kade');
  dash(K, 13.0, 1640, { dur: 0.25 });
  K.key(13.32, 'slashWind', { ease: 'out' });
  K.key(13.43, 'slash', { ease: 'snap', dx: 20 });
  V.key(13.35, 'catch', { ease: 'snap', breathe: 0 });
  ev('impact', 13.43, { at: 'vorthak.fist', kind: 'clang', size: 1.2 });
  ev('hitstop', 13.43, { dur: 0.08 });
  S.key(13.15, 'crouch', { ease: 'out' });
  S.key(13.45, 'scytheRaise', { x: 1520, air: 150, ease: 'out', moveEase: 'out' });
  V.key(13.6, 'throw', { ease: 'snap' });
  swing(13.6, 0.8);
  K.key(13.6, 'flung', { ease: 'snap', dx: -60, air: 130 });
  ev('impact', 13.64, { at: 'kade.chest', kind: 'heavy', size: 1.3, ox: -20 });
  ev('shake', 13.64, { amount: 10, dur: 0.3 });
  S.hold(13.62);
  S.key(13.66, 'flung', { ease: 'snap', dx: -20 });
  K.key(14.1, 'down', { x: 1300, air: 0, ease: 'inOut', moveEase: 'out' });
  K.key(14.22, P('down', { rot: -86 }), { ease: 'out' });
  S.key(14.15, 'down', { x: 1240, air: 0, ease: 'inOut', moveEase: 'out' });
  S.key(14.27, P('down', { rot: -86 }), { ease: 'out' });
  ev('dust', 14.1, { at: 'kade.hip', size: 1.2, count: 10 });
  ev('dust', 14.15, { at: 'sora.hip', size: 1.2, count: 10 });
  ev('sfx', 14.1, { name: 'land' });
  ev('sfx', 14.16, { name: 'land', gain: 0.8 });
  ev('shake', 14.12, { amount: 6, dur: 0.25 });
  // Vorthak walks over.
  V.key(14.4, 'hunch', { breathe: 0.5 });
  V.key(14.8, 'walk1', { dx: -45 });
  V.key(15.2, 'walk2', { dx: -45 });
  V.key(15.45, 'hunch', { dx: -15 });
  for (const t of [14.8, 15.2]) {
    ev('sfx', t, { name: 'land', gain: 0.5 });
    ev('shake', t, { amount: 3, dur: 0.15 });
  }

  // 15.4 — Vorthak powers up.
  ev('sfx', 15.5, { name: 'powerUp', gain: 1 });
  V.key(15.8, 'powerUp', { aura: 0.6, auraColor: '#ff2040', ease: 'inOut', breathe: 0 });
  V.key(17.1, 'powerUp', { aura: 1 });
  ev('shake', 15.7, { amount: 3, dur: 1.7 });
  say(15.9, 1.4, 'vorthak', 'Enough playing.', '#9b0f22');
  K.hold(16.4);
  K.key(16.75, 'rise');
  K.key(17.05, 'swordReady');
  S.hold(16.5);
  S.key(16.85, 'rise');
  S.key(17.15, 'scytheReady');
  const roar = 17.5;
  ev('sfx', roar - 0.1, { name: 'roar', gain: 1.3 });
  ev('sfx', roar, { name: 'heavy' });
  V.key(roar, 'roar', { ease: 'snap', aura: 1 });
  ev('flash', roar, { color: '255,40,60', life: 0.35, strength: 0.6 });
  ev('ring', roar, { at: 'vorthak.chest', size: 2.2, color: 'rgba(255,40,70,', life: 0.6 });
  ev('shake', roar, { amount: 16, dur: 0.7 });
  ev('dust', roar, { at: 'vorthak.foot', size: 1.6, count: 12 });
  ev('impactFrames', roar, { count: 2 });
  ev('punch', roar, { amount: 0.15, dur: 0.5 });
  ev('tilt', roar, { angle: 3, dur: 0.8 });
  ev('split', roar, { amount: 6, dur: 0.4 });
  ev('sfx', roar, { name: 'braam', gain: 0.9 });
  ev('sprite', roar, { at: 'vorthak.hip', ground: true, name: 'ground-dust-by-vamz', scale: 0.5, tint: '#ffb0b8' });
  K.key(17.6, 'block', { dx: -40, ease: 'out' });
  K.key(18.0, 'swordReady');
  S.key(17.6, 'block', { dx: -90, ease: 'out' });
  S.key(18.0, 'scytheReady');
  V.key(18.0, 'hunch', { aura: 0.7 });

  // 18.1 — Uppercut, then a slam from above.
  swing(18.12, 0.9);
  rushBoost(18.12, 'vorthak');
  V.key(18.25, 'dash', { ease: 'out', x: 1370 });
  V.key(18.3, 'upperWind', { ease: 'out' });
  const upper = 18.4;
  V.key(upper, 'upper', { ease: 'snap' });
  ev('impact', upper, { at: 'vorthak.fist', kind: 'dark', size: 1.8 });
  ev('hitstop', upper, { dur: 0.12 });
  ev('shake', upper, { amount: 14, dur: 0.35 });
  ev('flash', upper, { life: 0.15, strength: 0.4 });
  ev('punch', upper, { amount: 0.15 });
  ev('tilt', upper, { angle: -4, dur: 0.6 });
  ev('split', upper, { amount: 8 });
  K.hold(upper);
  K.key(upper + 0.06, 'flung', { ease: 'snap', air: 60, dx: -10 });
  K.key(18.85, P('flung', { rot: -160 }), { ease: 'out', air: 270, dx: -40 });
  V.key(18.58, 'crouch', { ease: 'out' });
  V.key(18.88, 'smashWind', { ease: 'out', air: 250, dx: -90 });
  const smash = 18.98;
  V.key(smash, 'smash', { ease: 'snap' });
  swing(smash, 0.9);
  ev('impact', smash, { at: 'vorthak.fist', kind: 'dark', size: 1.5 });
  ev('hitstop', smash, { dur: 0.08 });
  K.hold(smash);
  const slamAt = 19.16;
  K.key(slamAt, 'down', { ease: 'in', air: 0, dx: -40, moveEase: 'in' });
  slam(slamAt, 'kade', 1.2);
  ev('flash', slamAt, { life: 0.2, strength: 0.35 });
  V.key(19.32, 'crouch', { air: 0, ease: 'in', moveEase: 'in' });
  ev('dust', 19.32, { at: 'vorthak.foot', size: 1.2 });
  ev('sfx', 19.32, { name: 'land', gain: 0.8 });
  V.key(19.6, 'hunch');
  // Sora leaps over Kade; Vorthak blocks and swipes; she springs away.
  const soraChop = jump(S, 19.45, 1215, { height: 120, dur: 0.38, airPose: 'scytheRaise', land: 'scytheChop', after: null });
  swing(soraChop, 0.7);
  V.key(soraChop - 0.06, 'block', { ease: 'snap' });
  ev('impact', soraChop, { at: 'sora.tip', kind: 'clang', size: 1 });
  ev('hitstop', soraChop, { dur: 0.05 });
  V.key(20.1, 'backhandWind', { ease: 'out' });
  V.key(20.2, 'clawSwipe', { ease: 'snap', dx: -20 });
  swing(20.2, 0.8);
  jump(S, 20.02, 1010, { height: 90, dur: 0.4, airPose: 'tuck', land: 'crouch', after: 'scytheReady' });
  V.key(20.5, 'hunch');
  // The energy wave.
  S.key(20.8, 'scytheRaise', { weaponGlow: 1, ease: 'out' });
  const cast = 20.93;
  S.key(cast, 'scytheSweep', { ease: 'snap', weaponGlow: 0.3 });
  ev('wave', cast, { from: 'sora.chest', to: 'vorthak.chest', life: 0.28, size: 1.1 });
  const waveHits = cast + 0.28;
  ev('impact', waveHits, { at: 'vorthak.chest', kind: 'purple', size: 1.8 });
  ev('hitstop', waveHits, { dur: 0.1 });
  ev('shake', waveHits, { amount: 12, dur: 0.3 });
  ev('punch', waveHits, { amount: 0.1 });
  react(V, waveHits, { pose: 'hurt', dx: 90, dur: 0.5, recover: 'hunch' });
  S.key(21.4, 'scytheReady', { weaponGlow: 0 });
  K.hold(20.6);
  K.key(20.95, 'rise');
  K.key(21.25, 'swordReady');

  // 21.75 — The clash: blade against claws, held in slow motion.
  K.key(21.75, 'slashWind', { ease: 'out' });
  V.key(21.75, 'backhandWind', { ease: 'out' });
  rushBoost(21.76, 'kade');
  swing(21.9, 1);
  const clash = 21.92;
  K.key(clash, 'clashK', { x: 1200, ease: 'snap' });
  V.key(clash, 'clashV', { x: 1370, ease: 'snap' });
  ev('impact', clash, { at: 'kade.tip', kind: 'clang', size: 2.2, gain: 1.4 });
  ev('impactFrames', clash, { count: 2 });
  ev('flash', clash, { life: 0.3, strength: 0.6 });
  ev('ring', clash, { at: 'kade.tip', size: 2, life: 0.6 });
  ev('shake', clash, { amount: 18, dur: 0.6 });
  ev('punch', clash, { amount: 0.18, dur: 0.5 });
  ev('tilt', clash, { angle: 5, dur: 2.5 });
  ev('split', clash, { amount: 10, dur: 0.4 });
  ev('hitstop', clash, { dur: 0.12 });
  ev('sfx', clash, { name: 'braam', gain: 1.1 });
  ev('slowmo', clash + 0.02, { dur: 0.6, scale: 0.2 });
  // Locked together, each shoving the other, sparks pouring off the blade.
  for (let i = 0; i < 7; i += 1) {
    const t = clash + 0.05 + i * 0.08;
    const push = i % 2 ? 5 : -5;
    K.key(t, P('clashK', { lean: 30 + push }), { dx: push * 0.6, ease: 'inOut' });
    V.key(t, P('clashV', { lean: 32 - push }), { dx: push * 0.6, ease: 'inOut' });
    ev('sparks', t, { at: 'kade.tip', count: 6, color: '#fff2c0', speed: 300, angle: -Math.PI / 2, spread: 1.6 });
    if (i % 2 === 0) ev('sfx', t, { name: 'clang', gain: 0.25 });
  }
  say(clash + 0.04, 0.56, 'kade', 'Not... this... time!');
  // Kade breaks through.
  const breakThrough = 22.6;
  K.key(breakThrough, 'slash', { ease: 'snap', dx: 60 });
  swing(breakThrough, 1);
  ev('impact', breakThrough, { at: 'vorthak.chest', kind: 'slash', size: 1.8 });
  ev('split', breakThrough, { amount: 8 });
  ev('shake', breakThrough, { amount: 12, dur: 0.35 });
  ev('hitstop', breakThrough, { dur: 0.08 });
  react(V, breakThrough, { pose: 'hurt', dx: 120, dur: 0.45, recover: null });

  // 22.7 — The juggle: Sora launches him, both chase him into the air.
  S.key(22.7, 'crouch', { ease: 'out' });
  rushBoost(22.75, 'sora');
  dash(S, 22.75, 1420, { dur: 0.2, pose: 'scytheSweepWind' });
  const launcher = 23.02;
  S.key(launcher, 'scytheRaise', { ease: 'snap', air: 40 });
  swing(launcher, 0.9);
  ev('impact', launcher, { at: 'vorthak.hip', kind: 'purple', size: 1.6 });
  ev('punch', launcher, { amount: 0.1 });
  ev('shake', launcher, { amount: 10, dur: 0.3 });
  ev('hitstop', launcher, { dur: 0.06 });
  V.hold(launcher);
  V.key(launcher + 0.06, 'flung', { ease: 'snap', air: 80 });
  V.key(23.45, P('flung', { rot: -40 }), { ease: 'out', air: 280, dx: 20 });
  K.key(23.08, 'crouch', { ease: 'out' });
  ev('sprite', 23.1, { at: 'kade.hip', ground: true, name: 'ground-dust-by-vamz', scale: 0.32 });
  ev('sfx', 23.1, { name: 'whoosh', gain: 0.8 });
  K.key(23.4, 'slashWind', { x: 1430, air: 250, ease: 'out', moveEase: 'out' });
  // Kade's air slashes; each one keeps Vorthak aloft.
  const airHits = [
    [23.48, 'slash', 265, -60, 300],
    [23.68, 'slashLow', 275, -80, 310],
  ];
  for (const [t, move, air, rot, lift] of airHits) {
    K.key(t - 0.08, move === 'slash' ? 'slashWind' : 'slashLowWind', { ease: 'out', air: air - 10 });
    K.key(t, move, { ease: 'snap', air });
    swing(t, 0.7);
    ev('impact', t, { at: 'vorthak.chest', kind: 'slash', size: 1.2 });
    ev('hitstop', t, { dur: 0.05 });
    ev('punch', t, { amount: 0.06, dur: 0.2 });
    V.key(t + 0.04, P('flung', { rot }), { ease: 'snap', air: lift, dx: 10 });
  }
  // Sora joins from the far side.
  S.key(23.5, 'crouch', { air: 0, ease: 'in' });
  S.key(23.75, 'scytheSweepWind', { air: 300, x: 1560, ease: 'out', moveEase: 'out', facing: -1 });
  const soraAir = 23.85;
  S.key(soraAir, 'scytheSweep', { ease: 'snap', air: 300 });
  swing(soraAir, 0.8);
  ev('impact', soraAir, { at: 'vorthak.chest', kind: 'purple', size: 1.4 });
  ev('hitstop', soraAir, { dur: 0.06 });
  V.key(soraAir + 0.05, P('flung', { rot: -110 }), { ease: 'snap', air: 330, dx: -10 });
  // Kade flips over the top and dives.
  K.key(23.95, P('tuck', { rot: 180 }), { air: 390, x: 1470, ease: 'out', moveEase: 'out', trail: false });
  K.key(24.12, P('stomp', { rot: 360 }), { air: 400, ease: 'inOut' });
  const dive = 24.22;
  K.key(dive, P('stomp', { rot: 360 }), { air: 330, ease: 'snap' });
  ev('impact', dive, { at: 'vorthak.chest', kind: 'heavy', size: 2 });
  ev('impactFrames', dive, { count: 3 });
  ev('flash', dive, { life: 0.2, strength: 0.5 });
  ev('tilt', dive, { angle: -6, dur: 0.8 });
  ev('punch', dive, { amount: 0.2, dur: 0.4 });
  ev('split', dive, { amount: 10 });
  ev('hitstop', dive, { dur: 0.12 });
  ev('sfx', dive, { name: 'boom', gain: 0.9 });
  const crater = 24.4;
  V.key(crater, 'down', { air: 0, ease: 'in', moveEase: 'in' });
  slam(crater, 'vorthak', 1.6);
  K.key(24.55, P('crouch', { rot: 360 }), { air: 0, x: 1400, ease: 'in', moveEase: 'in' });
  K.key(24.58, 'crouch', { ease: 'hold' });
  K.key(24.85, 'swordReady', { trail: true });
  S.key(24.3, 'crouch', { air: 0, x: 1610, ease: 'in', moveEase: 'in' });
  S.key(24.6, 'scytheReady');
  ev('sprite', 24.32, { at: 'sora.hip', ground: true, name: 'ground-dust-by-vamz', scale: 0.25 });

  // 24.9 — Vorthak rises in a rage.
  V.hold(24.9);
  V.key(25.3, 'rise', { aura: 1.2 });
  ev('sfx', 25.0, { name: 'powerUp', gain: 0.7 });
  const rage = 25.6;
  V.key(rage, 'roar', { ease: 'snap', aura: 1.3 });
  ev('sfx', rage - 0.08, { name: 'roar', gain: 1.4 });
  ev('sfx', rage, { name: 'braam', gain: 0.9 });
  ev('flash', rage, { color: '255,40,60', life: 0.4, strength: 0.7 });
  ev('ring', rage, { at: 'vorthak.chest', size: 2.6, color: 'rgba(255,40,70,', life: 0.7 });
  ev('impactFrames', rage, { count: 2 });
  ev('shake', rage, { amount: 20, dur: 0.8 });
  ev('tilt', rage, { angle: 4, dur: 0.8 });
  ev('sprite', rage, { at: 'vorthak.hip', ground: true, name: 'ground-dust-by-vamz', scale: 0.55, tint: '#ffb0b8' });
  say(rage + 0.1, 1.2, 'vorthak', 'INSECTS!', '#b0102a');
  K.key(rage + 0.05, 'flung', { dx: -170, air: 40, ease: 'snap' });
  K.key(rage + 0.4, 'skid', { air: 0, dx: -40, ease: 'out' });
  K.key(rage + 0.7, 'swordReady');
  S.key(rage + 0.05, 'flung', { dx: 170, air: 40, ease: 'snap' });
  S.key(rage + 0.4, 'skid', { air: 0, dx: 40, ease: 'out' });
  S.key(rage + 0.7, 'scytheReady');
  ev('dust', rage + 0.4, { at: 'kade.foot', dir: -1 });
  ev('dust', rage + 0.4, { at: 'sora.foot', dir: 1 });
  V.key(26.1, 'hunch', { aura: 1.1 });

  // 26.3 — The finisher. The music drops out; both charge; they cross through him.
  say(26.3, 1.0, 'sora', 'Kade, together!', '#3b2470');
  say(26.75, 0.8, 'kade', 'Now!');
  K.key(26.7, 'sheathe', { weaponGlow: 1, ease: 'inOut', trail: false });
  S.key(26.7, 'scytheSweepWind', { weaponGlow: 1, ease: 'inOut' });
  ev('sfx', 26.6, { name: 'riser', gain: 1 });
  V.key(27.0, 'crouch', { ease: 'out' });
  V.key(27.3, 'dash', { x: 1330, ease: 'in' });
  ev('slowmo', 27.15, { dur: 0.3, scale: 0.2 });
  ev('sfx', 27.16, { name: 'boom', gain: 0.5 });
  K.key(27.44, 'sheathe', { trail: true });
  S.key(27.44, 'scytheSweepWind');
  const cross = 27.5;
  K.key(cross, 'dashCut', { x: 1720, ease: 'snap', moveEase: 'linear' });
  S.key(cross, 'scytheSweep', { x: 1180, ease: 'snap', moveEase: 'linear' });
  rushBoost(cross - 0.04, 'kade');
  rushBoost(cross - 0.04, 'sora');
  ev('speedLines', cross - 0.05, { life: 0.4 });
  ev('flash', cross, { life: 0.2, strength: 0.9 });
  ev('impactFrames', cross, { count: 4 });
  ev('sfx', cross - 0.03, { name: 'slash', gain: 1.2 });
  ev('sfx', cross, { name: 'slash', gain: 1 });
  ev('hitstop', cross + 0.02, { dur: 0.7 });
  const opens = cross + 0.06;
  ev('slashLine', opens, { at: 'vorthak.chest', from: [-90, -80], to: [90, 70], width: 9 });
  ev('slashLine', opens, { at: 'vorthak.chest', from: [-90, 70], to: [90, -80], width: 9, glow: '#a070ff' });
  ev('impact', opens, { at: 'vorthak.chest', kind: 'slash', size: 2.5 });
  ev('ring', opens, { at: 'vorthak.chest', size: 3, color: 'rgba(170,120,255,', life: 0.8 });
  ev('flash', opens, { color: '255,235,240', life: 0.5, strength: 0.7 });
  ev('impactFrames', opens, { count: 3 });
  ev('split', opens, { amount: 14, dur: 0.5 });
  ev('shake', opens, { amount: 24, dur: 0.9 });
  ev('punch', opens, { amount: 0.25, dur: 0.6 });
  ev('tilt', opens, { angle: 7, dur: 1.2 });
  ev('sfx', opens, { name: 'braam', gain: 1.3 });
  ev('sfx', opens, { name: 'boom', gain: 1.1 });
  ev('hitstop', opens + 0.02, { dur: 0.15 });
  ev('crack', opens, { at: 'vorthak.hip', size: 1.8, crater: true });
  ev('sprite', opens, { at: 'vorthak.hip', ground: true, name: 'ground-dust-by-vamz', scale: 0.7 });
  ev('debris', opens, { at: 'vorthak.hip', count: 28, size: 1.3 });
  react(V, opens, { pose: 'hurtLow', dx: 0, dur: 0.5, recover: null });
  V.key(opens + 1.0, null, { aura: 0 });
  V.key(28.4, 'kneel', { ease: 'out' });
  K.key(28.1, 'sheathe', { weaponGlow: 0, trail: false });
  K.key(28.6, 'stand', { weapon: false });
  ev('sfx', 28.6, { name: 'block', gain: 0.4 });
  S.key(28.3, 'scytheReady', { weaponGlow: 0 });

  // 28.7 — The end.
  say(28.7, 1.9, 'vorthak', '...Not bad... for insects.', '#3a0a10');
  K.key(29.4, 'stand', { facing: -1 });
  S.key(29.6, 'stand', { facing: 1 });
  V.key(30.6, 'kneel');
  V.key(31.1, 'down', { ease: 'in' });
  ev('dust', 31.1, { at: 'vorthak.hip', size: 2, count: 14 });
  ev('sprite', 31.1, { at: 'vorthak.hip', ground: true, name: 'ground-dust-by-vamz', scale: 0.4 });
  ev('sfx', 31.1, { name: 'land' });
  ev('shake', 31.1, { amount: 8, dur: 0.3 });
  say(31.4, 1.6, 'kade', 'Guess we found out.');

  const camera = [
    { t: 0, x: 1700, y: 380, zoom: 1.55, bars: 1, fade: 1 },
    { t: 0.7, x: 1700, y: 380, zoom: 1.55, bars: 1, fade: 0 },
    { t: 2.2, x: 1650, y: 385, zoom: 1.5, bars: 1 },
    { t: 3.4, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.25, bars: 0.6 },
    { t: 6.4, follow: ['kade', 'vorthak'], y: 400, zoom: 1.32, bars: 0.6 },
    { t: 7.4, follow: ['kade', 'vorthak'], y: 400, zoom: 1.45, bars: 0.6 },
    { t: 8.0, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.25, bars: 0.6 },
    { t: 12.8, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.25, bars: 0.6 },
    { t: 13.4, follow: ['kade', 'vorthak'], y: 390, zoom: 1.4, bars: 0.6 },
    { t: 14.3, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.25, bars: 0.6 },
    { t: 15.6, follow: ['vorthak'], y: 390, zoom: 1.28, bars: 0.6 },
    { t: 16.9, follow: ['vorthak'], y: 395, zoom: 1.75, dim: 0.7, bars: 0.9 },
    { t: 17.6, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.25, dim: 0.25, bars: 0.6, ease: 'out' },
    { t: 18.3, follow: ['kade', 'vorthak'], y: 400, zoom: 1.35, dim: 0.25, bars: 0.6 },
    { t: 19.4, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.25, dim: 0.25, bars: 0.6 },
    { t: 21.4, follow: ['kade', 'vorthak'], y: 400, zoom: 1.35, dim: 0.25, bars: 0.6 },
    { t: 21.9, follow: ['kade', 'vorthak'], y: 395, zoom: 1.95, dim: 0.55, bars: 1, ease: 'out' },
    { t: 22.55, follow: ['kade', 'vorthak'], y: 395, zoom: 2.05, dim: 0.55, bars: 1 },
    { t: 22.75, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.3, dim: 0.25, bars: 0.6, ease: 'out' },
    { t: 24.3, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.3, dim: 0.25, bars: 0.6 },
    { t: 25.2, follow: ['vorthak'], y: 390, zoom: 1.6, dim: 0.5, bars: 0.9 },
    { t: 25.7, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.15, dim: 0.35, bars: 0.7, ease: 'out' },
    { t: 26.6, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.2, dim: 0.35, bars: 0.7 },
    { t: 27.15, follow: ['kade', 'vorthak'], y: 405, zoom: 1.75, dim: 0.6, bars: 1 },
    { t: 27.5, follow: ['kade', 'vorthak'], y: 405, zoom: 1.75, dim: 0.6, bars: 1 },
    { t: 27.6, follow: ['kade', 'sora', 'vorthak'], y: 395, zoom: 1.2, dim: 0.3, bars: 0.8, ease: 'out' },
    { t: 28.6, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.28, dim: 0, bars: 0.7 },
    { t: 31.4, follow: ['kade', 'sora', 'vorthak'], y: 400, zoom: 1.32, bars: 0.8 },
    { t: 33.0, follow: ['kade', 'sora', 'vorthak'], y: 390, zoom: 1.15, bars: 1 },
    { t: 34.4, follow: ['kade', 'sora', 'vorthak'], y: 390, zoom: 1.12, bars: 1, fade: 1 },
  ];

  return {
    duration: 34.4,
    order: ['vorthak', 'sora', 'kade'],
    tracks: { kade: K, sora: S, vorthak: V },
    events,
    camera,
    music: {
      bpm: 150,
      sections: [
        { from: 0, to: 6.6, level: 0 },
        { from: 6.6, to: 15.4, level: 2 },
        { from: 15.4, to: 17.4, level: 1 },
        { from: 17.4, to: 21.9, level: 3 },
        { from: 21.9, to: 22.6, level: 1 },
        { from: 22.6, to: 25.2, level: 4 },
        { from: 25.2, to: 26.6, level: 2 },
        { from: 26.6, to: 35, level: 0 },
      ],
    },
    overlay: title,
  };
}

/** The title card over the last two seconds. */
function title(ctx, view, t) {
  const fadeIn = Math.min(1, Math.max(0, (t - 32.6) / 0.6));
  if (fadeIn <= 0) return;
  ctx.save();
  ctx.globalAlpha = fadeIn;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '64px Impact';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0d0b0e';
  ctx.strokeText('KADE & SORA  vs  VORTHAK', view.width / 2, view.height * 0.3);
  ctx.fillStyle = '#f3f3f7';
  ctx.fillText('KADE & SORA  vs  VORTHAK', view.width / 2, view.height * 0.3);
  ctx.font = 'bold 20px Bahnschrift';
  ctx.fillStyle = '#d12b2b';
  ctx.fillText('a stick fight made with code', view.width / 2, view.height * 0.3 + 52);
  ctx.restore();
}
