/**
 * Part two of Kade vs Vorthak: the demon and the ice.
 *
 * Beaten on the terrace, Vorthak rises again as a demon spewing red
 * lightning, and overpowers Kade. On his knees, Kade finds ice. They fight
 * again, meet beam against beam, and Kade freezes the demon solid and
 * shatters it, leaving Vorthak as he was.
 *
 * Times are seconds after `start`, written as T(seconds):
 *
 *   0.0   the storm gathers over the fallen Vorthak; Kade draws
 *   1.4   he rises wrong, and grows; the roar blows Kade back
 *   3.6   a bolt from his hand blasts Kade into the hall; lightning chases him
 *   6.2   on his knees, Kade's hand on the floor: frost spreads, and he rises in ice
 *   8.7   a bolt shatters on an ice wall; spikes of ice; a lightning dive, parried
 *  10.8   lightning against ice, beam against beam, until the ice wins
 *  13.9   three cuts of ice freeze him solid
 *  16.2   Kade sheathes his sword, and the ice shatters
 */
import { P, launch, jump } from '../timeline.mjs';

const ICE = '#5fd4ff';
const FROST_AURA = '#9fe8ff';
const RED = '#ff2040';

/**
 * Write part two onto the tracks from `start` (fight seconds). Returns when
 * it ends, when the title card should come up, its camera keys, and the
 * windows where the song should dip.
 */
export function partTwo({ K, V, ev, start }) {
  const T = s => start + s;
  const swing = (t, gain = 0.5) => ev('sfx', t - 0.04, { name: 'whoosh', gain });
  const kx = () => K.keys[K.keys.length - 1].x;

  // The storm gathers over the fallen Vorthak. Kade draws his sword.
  const fallen = V.before(T(0)).x;
  V.key(T(0.3), null, { demon: 0.3, aura: 0.3, auraColor: RED });
  ev('sfx', T(0.3), { name: 'thunder', gain: 0.6 });
  ev('skyBolt', T(0.6), { x: fallen + 180 });
  ev('skyBolt', T(1.1), { x: fallen - 150 });
  K.key(T(0.5), 'stance');
  ev('sfx', T(0.9), { name: 'draw', gain: 0.8 });
  K.key(T(1.0), 'swordReady', { weapon: true });

  // He rises wrong, and grows. The roar blows Kade back.
  // He ended part one facing away, past where Kade cut through him; he turns to face him as he rises.
  V.key(T(1.4), P('rise', { rot: -30 }), { demon: 0.6, size: 1.08, aura: 0.7, facing: -1 });
  ev('sfx', T(1.4), { name: 'growl', gain: 0.9 });
  V.key(T(1.9), 'rise', { size: 1.15 });
  const roar = T(2.4);
  V.key(roar, 'roar', { demon: 1, size: 1.3, aura: 1.3, ease: 'snap' });
  ev('skyBolt', roar - 0.02, { at: 'vorthak.hip' });
  ev('skyBolt', roar + 0.1, { x: fallen - 220 });
  ev('skyBolt', roar + 0.1, { x: fallen + 220 });
  ev('flash', roar, { color: '255,40,60', life: 0.45, strength: 0.6 });
  ev('ring', roar, { at: 'vorthak.chest', size: 2.6, color: 'rgba(255,40,70,', life: 0.7 });
  ev('shake', roar, { amount: 20, dur: 0.8 });
  ev('impactFrames', roar, { count: 2 });
  ev('sfx', roar - 0.08, { name: 'roar', gain: 1.3 });
  ev('sfx', roar, { name: 'braam', gain: 1.2 });
  ev('dust', roar, { at: 'vorthak.foot', size: 2, count: 14 });
  K.key(roar + 0.05, 'flung', { dx: -120, air: 40, ease: 'snap' });
  K.key(roar + 0.45, 'skid', { air: 0, dx: -60, ease: 'out' });
  ev('dust', roar + 0.45, { at: 'kade.foot', dir: -1 });
  K.key(roar + 0.8, 'swordReady');
  V.key(T(3.2), 'hunch', { aura: 1 });

  // A bolt from his hand. Kade blocks, and is blasted back into the hall.
  V.key(T(3.6), 'blast', { ease: 'out' });
  K.key(T(3.7), 'block', { ease: 'snap' });
  const bolt1 = T(3.8);
  ev('bolt', bolt1, { from: 'vorthak.fist', to: 'kade.chest', life: 0.25, width: 6, branches: 3 });
  ev('impact', bolt1, { at: 'kade.chest', kind: 'dark', size: 1.5, contact: false });
  ev('hitstop', bolt1, { dur: 0.08 });
  ev('shake', bolt1, { amount: 12, dur: 0.35 });
  const blasted = launch(K, bolt1 + 0.05, { dx: -420, peak: 120, flight: 0.7, rise: false });
  ev('dust', blasted, { at: 'kade.hip', size: 1.4, count: 12 });
  ev('sfx', blasted, { name: 'land' });
  V.key(T(4.1), 'hunch');
  // Lightning chases him across the floor while Vorthak walks after him.
  ev('skyBolt', T(4.9), { at: 'kade.hip', ox: 70 });
  ev('skyBolt', T(5.3), { at: 'kade.hip', ox: -60 });
  K.key(T(5.0), P('down', { rot: -86, bs: 40 }), { ease: 'snap' });
  K.key(T(5.6), P('down', { rot: -86 }), { ease: 'inOut' });
  ev('sfx', T(4.4), { name: 'growl', gain: 0.8 });
  for (let i = 0; i < 4; i += 1) V.key(T(4.4 + i * 0.5), i % 2 ? 'walk2' : 'walk1', { dx: -140, ease: 'linear', moveEase: 'linear' });
  ev('skyBolt', T(5.8), { at: 'vorthak.hip', ox: 160 });
  V.key(T(6.5), 'hunch');

  // On his knees, his hand on the floor. Frost spreads, and he rises in ice.
  K.key(T(5.95), 'kneel', { ease: 'inOut' });
  K.key(T(6.4), P('kneel', { fs: 5, fe: -5, lean: 30, head: 10 }), { ease: 'out' });
  ev('sfx', T(6.35), { name: 'powerUp', gain: 0.5 });
  ev('frostFloor', T(6.5), { at: 'kade.fist', width: 240, grow: 1 });
  for (const t of [6.5, 6.9, 7.3]) ev('frost', T(t), { at: 'kade.chest', count: 10, spread: 40, speed: 70 });
  ev('sfx', T(6.5), { name: 'freeze', gain: 0.9 });
  K.key(T(7.35), 'rise', { ease: 'out' });
  const awaken = T(7.6);
  K.key(awaken, 'swordReady', { signature: ICE, aura: 1, auraColor: FROST_AURA, weaponGlow: 1, weapon: true, ease: 'snap' });
  ev('flash', awaken, { color: '170,235,255', life: 0.4, strength: 0.55 });
  ev('ring', awaken, { at: 'kade.chest', size: 2.4, color: 'rgba(160,230,255,', life: 0.7 });
  ev('iceSpikes', awaken, { at: 'kade.foot', ox: 50, dir: 1, count: 3, spacing: 40, height: 60 });
  ev('iceSpikes', awaken, { at: 'kade.foot', ox: -50, dir: -1, count: 3, spacing: 40, height: 60 });
  ev('frost', awaken, { at: 'kade.chest', count: 30, spread: 60, speed: 160 });
  ev('sfx', awaken, { name: 'braam', gain: 1 });
  ev('shake', awaken, { amount: 10, dur: 0.4 });
  ev('punch', awaken, { amount: 0.12 });
  K.key(T(8.2), 'swordReady', { aura: 0.45 });
  V.key(T(7.8), P('hunch', { head: -32 }), { ease: 'out' });
  ev('sfx', T(7.8), { name: 'growl', gain: 0.8 });
  V.key(T(8.3), 'hunch');

  // A bolt shatters on a wall of ice; spikes of ice race at him; he leaps them and dives.
  V.key(T(8.7), 'blast', { ease: 'out' });
  K.key(T(8.75), 'cast', { ease: 'snap' });
  const wallX = kx() + 70;
  ev('iceWall', T(8.8), { x: wallX, shatterAt: 0.22 });
  const bolt2 = T(8.9);
  ev('bolt', bolt2, { from: 'vorthak.fist', to: { x: wallX + 25, y: 450 }, life: 0.2, width: 6, branches: 3 });
  ev('impact', bolt2, { x: wallX + 25, y: 450, kind: 'dark', size: 1.2, contact: false });
  ev('hitstop', bolt2, { dur: 0.06 });
  ev('sfx', bolt2 + 0.1, { name: 'shatter', gain: 0.9 });
  K.key(T(9.25), 'slashLowWind', { ease: 'out' });
  const spikes = T(9.38);
  K.key(spikes, 'slashLow', { ease: 'snap' });
  swing(spikes, 0.7);
  ev('iceSpikes', spikes + 0.02, { at: 'kade.foot', ox: 60, dir: 1, count: 7, spacing: 48 });
  V.key(T(9.45), 'crouch', { ease: 'out' });
  const dive = jump(V, T(9.45), kx() + 150, { height: 210, dur: 0.55, airPose: 'smashWind', land: 'smash', after: null });
  K.key(dive - 0.08, 'block', { ease: 'snap' });
  swing(dive, 0.9);
  ev('impact', dive, { at: 'kade.tip', kind: 'clang', size: 1.6, contact: false });
  ev('frost', dive, { at: 'kade.tip', count: 14, spread: 20, speed: 160 });
  ev('sparks', dive, { at: 'kade.tip', count: 14, color: '#ff6a6a', speed: 340 });
  ev('hitstop', dive, { dur: 0.1 });
  ev('shake', dive, { amount: 14, dur: 0.4 });
  ev('split', dive, { amount: 8 });
  K.key(dive + 0.22, 'skid', { dx: -90, ease: 'out' });
  V.key(dive + 0.22, 'hunch', { dx: 90, ease: 'out' });
  K.key(dive + 0.5, 'swordReady');

  // Lightning against ice, beam against beam, until the ice wins.
  const clash = T(11.0);
  V.key(T(10.8), 'blast', { ease: 'out' });
  K.key(T(10.8), P('cast', { w: 0 }), { ease: 'out' });
  for (let i = 1; i <= 6; i += 1) {
    const shove = i % 2 ? 4 : -4;
    K.key(clash + i * 0.35, P('cast', { w: 0, lean: 18 + shove }), { ease: 'inOut' });
    V.key(clash + i * 0.35, P('blast', { lean: 20 - shove }), { ease: 'inOut' });
    ev('shake', clash + i * 0.35, { amount: 4, dur: 0.3 });
    ev('sfx', clash + i * 0.35, { name: 'zap', gain: 0.45 });
  }
  ev('beamClash', clash, { dur: 2.4, push: [[0, 0.5], [0.25, 0.62], [0.45, 0.4], [0.6, 0.55], [0.75, 0.32], [1, 0.97]] });
  ev('slowmo', clash + 0.2, { dur: 0.8, scale: 0.35 });
  const blowout = clash + 2.4;
  ev('impact', blowout, { at: 'vorthak.chest', kind: 'heavy', size: 2, contact: false });
  ev('flash', blowout, { color: '200,240,255', life: 0.5, strength: 0.7 });
  ev('ring', blowout, { at: 'vorthak.chest', size: 2.6, color: 'rgba(160,230,255,', life: 0.7 });
  ev('shatter', blowout, { at: 'vorthak.chest', count: 20, size: 1 });
  ev('impactFrames', blowout, { count: 2 });
  ev('shake', blowout, { amount: 18, dur: 0.6 });
  ev('sfx', blowout, { name: 'braam', gain: 1.1 });
  ev('hitstop', blowout, { dur: 0.12 });
  V.key(blowout + 0.05, 'hurt', { dx: 80, ease: 'snap', frozen: 0.3 });
  V.key(blowout + 0.4, 'hurtLow', { ease: 'out' });

  // Three cuts of ice, each freezing him further, until he stands frozen solid.
  const cuts = [[13.9, 1, 170, 0.55], [14.3, -1, -170, 0.8], [14.7, 1, 210, 1]];
  cuts.forEach(([s, facing, past, frozen], i) => {
    const t = T(s);
    const vx = V.before(t).x;
    K.key(t - 0.14, 'sheathe', { facing, trail: false });
    K.key(t - 0.04, 'sheathe', { trail: true });
    K.key(t, 'dashCut', { x: vx + past, ease: 'snap', moveEase: 'linear' });
    ev('speedLines', t - 0.05, { life: 0.3, dir: facing });
    ev('sfx', t - 0.03, { name: 'slash', gain: 1 });
    ev('slashLine', t + 0.04, { at: 'vorthak.chest', from: [-80, i % 2 ? 60 : -70], to: [80, i % 2 ? -70 : 60], width: 7, glow: ICE });
    ev('impact', t + 0.04, { at: 'vorthak.chest', kind: 'slash', size: 1.4, contact: false });
    ev('frost', t + 0.04, { at: 'vorthak.chest', count: 14, spread: 40, speed: 120 });
    ev('hitstop', t + 0.06, { dur: 0.06 });
    V.key(t + 0.08, null, { frozen });
  });
  ev('sfx', T(14.9), { name: 'ice', gain: 1 });
  // Frozen through, his fire goes out.
  V.key(T(14.85), null, { aura: 0 });

  // Kade sheathes his sword with his back to him. On the click, the ice shatters.
  K.key(T(15.3), 'sheathe', { facing: 1, weaponGlow: 0, trail: false, aura: 0.2 });
  const shatter = T(16.2);
  K.key(shatter, 'stand', { weapon: false });
  ev('sfx', shatter - 0.02, { name: 'block', gain: 0.6 });
  ev('shatter', shatter, { at: 'vorthak.chest', count: 44, size: 1.5, gain: 1.4 });
  ev('flash', shatter, { color: '220,245,255', life: 0.5, strength: 0.8 });
  ev('impactFrames', shatter, { count: 2 });
  ev('shake', shatter, { amount: 18, dur: 0.6 });
  ev('sfx', shatter, { name: 'braam', gain: 1.2 });
  ev('sfx', shatter, { name: 'boom', gain: 0.8 });
  // The demon breaks with the ice: Vorthak is himself again, and falls.
  // He stays frozen solid right up to the click.
  V.hold(shatter);
  V.key(shatter + 0.02, 'hurtLow', { frozen: 0, demon: 0, size: 1, aura: 0, ease: 'snap' });
  V.key(T(16.7), 'kneel', { ease: 'out' });
  V.key(T(17.4), 'down', { ease: 'in' });
  ev('dust', T(17.4), { at: 'vorthak.hip', size: 1.6, count: 12 });
  ev('sfx', T(17.4), { name: 'land' });
  K.key(T(17.8), 'stand', { facing: -1, aura: 0 });

  const end = T(20.4);
  const both = ['kade', 'vorthak'];
  const camera = [
    { t: T(0), follow: both, fit: [1.2, 1.6], dim: 0, bars: 0.8 },
    { t: T(1.0), follow: ['vorthak'], zoom: 1.6, dim: 0.5, bars: 1 },
    { t: T(2.4), follow: both, fit: [1.0, 1.4], dim: 0.6, bars: 1, ease: 'out' },
    { t: T(3.5), follow: both, fit: [1.1, 1.6], dim: 0.55, bars: 0.8 },
    { t: T(4.6), follow: both, fit: [1.0, 1.5], dim: 0.55, bars: 0.8 },
    { t: T(6.2), follow: ['kade'], zoom: 2.0, dim: 0.45, bars: 1 },
    { t: T(7.6), follow: ['kade'], zoom: 1.7, dim: 0.35, bars: 1, ease: 'out' },
    { t: T(8.4), follow: both, fit: [1.2, 1.8], dim: 0.4, bars: 0.8 },
    { t: T(11.0), follow: both, zoom: 1.6, dim: 0.5, bars: 1 },
    { t: T(13.4), follow: both, fit: [1.3, 1.8], dim: 0.4, bars: 0.8 },
    { t: T(15.2), follow: ['vorthak'], zoom: 1.8, dim: 0.35, bars: 1 },
    { t: T(16.2), follow: both, fit: [1.2, 1.6], dim: 0.2, bars: 1, ease: 'out' },
    { t: T(17.6), follow: both, fit: [1.2, 1.5], dim: 0, bars: 1 },
    { t: end - 0.6, follow: both, fit: [1.15, 1.4], dim: 0, bars: 1 },
    { t: end, follow: both, fit: [1.15, 1.4], dim: 0, bars: 1, fade: 1 },
  ];
  // The song dips as the storm gathers and crashes in with the roar; dips again
  // while Kade kneels and swells as the ice wakes; and holds its breath before
  // the shatter.
  const ducks = [
    { from: T(0.2), to: roar - 0.05, gain: 0.25 },
    { from: T(6.0), to: awaken - 0.05, gain: 0.3 },
    { from: T(15.0), to: shatter - 0.05, gain: 0.2 },
  ];
  const storyboard = [
    { t: T(0.6), title: 'The storm gathers', note: 'Red lightning crawls over the fallen Vorthak and strikes around him.' },
    { t: T(2.8), title: 'The demon', note: 'He rises wrong and grows, veins burning red. The roar blows Kade back.' },
    { t: T(3.82), title: 'Overpowered', note: 'A bolt from his hand blasts Kade back into the hall.' },
    { t: T(6.6), title: 'Frost', note: 'On his knees, Kade presses a hand to the floor. Frost spreads from it.' },
    { t: T(7.62), title: 'Ice', note: 'He rises in ice: icy blue, sword frosted, spikes bursting around him.' },
    { t: T(9.42), title: 'Wall and spikes', note: 'A bolt shatters on a wall of ice; spikes race along the floor at Vorthak.' },
    { t: T(11.9), title: 'Beam against beam', note: 'Lightning against ice, pushing back and forth in slow motion.' },
    { t: T(15.6), title: 'Frozen solid', note: 'Three cuts of ice. Kade sheathes his sword with his back to him.' },
    { t: T(16.25), title: 'Shattered', note: 'On the click the ice breaks, and the demon with it. Vorthak is himself again.' },
  ];
  return { end, titleAt: T(18.0), camera, ducks, storyboard };
}
