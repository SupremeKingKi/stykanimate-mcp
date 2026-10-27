/**
 * Named key poses, all facing right. See rig.mjs for what each angle means.
 * Moves blend between these, and scenes may override single angles.
 */
export const POSES = {
  stand: { lean: 2, head: 0, fs: 8, fe: 12, bs: -8, be: 12, fh: 4, fk: 4, bh: -4, bk: 4 },
  stance: { lean: 10, head: -8, fs: 55, fe: 105, bs: 35, be: 120, fh: 28, fk: 28, bh: -22, bk: 30 },
  stanceLow: { lean: 18, head: -14, fs: 50, fe: 95, bs: 25, be: 115, fh: 38, fk: 55, bh: -26, bk: 55 },
  // The boss stands hunched, claws low and wide.
  hunch: { lean: 28, head: -26, fs: 35, fe: 40, bs: 15, be: 45, fh: 26, fk: 34, bh: -18, bk: 36 },
  taunt: { lean: -4, head: -12, fs: 25, fe: 20, bs: 20, be: 25, fh: 12, fk: 8, bh: -10, bk: 10 },

  run1: { lean: 28, head: -18, fs: 75, fe: 95, bs: -55, be: 80, fh: 65, fk: 25, bh: -35, bk: 95 },
  run2: { lean: 28, head: -18, fs: -50, fe: 85, bs: 70, be: 95, fh: -35, fk: 95, bh: 65, bk: 25 },
  dash: { lean: 38, head: -28, fs: -40, fe: 30, bs: -60, be: 30, fh: 50, fk: 45, bh: -45, bk: 40 },
  walk1: { lean: 24, head: -22, fs: 45, fe: 45, bs: 5, be: 40, fh: 32, fk: 14, bh: -22, bk: 38 },
  walk2: { lean: 24, head: -22, fs: 20, fe: 40, bs: 30, be: 45, fh: -14, fk: 40, bh: 30, bk: 14 },
  skid: { lean: -8, head: -6, fs: 60, fe: 90, bs: 20, be: 110, fh: 55, fk: 15, bh: -30, bk: 70 },

  jabWind: { lean: 6, head: -8, fs: 35, fe: 125, bs: 40, be: 120, fh: 28, fk: 28, bh: -22, bk: 30 },
  jab: { lean: 18, head: -10, fs: 90, fe: 2, bs: 40, be: 125, fh: 32, fk: 30, bh: -26, bk: 26 },
  cross: { lean: 26, head: -14, fs: 40, fe: 120, bs: 92, be: 2, fh: 38, fk: 38, bh: -30, bk: 12 },
  hook: { lean: 22, head: -12, fs: 80, fe: 75, bs: 30, be: 120, fh: 32, fk: 32, bh: -26, bk: 26 },
  upperWind: { lean: 32, head: -22, fs: -25, fe: 95, bs: 40, be: 120, fh: 55, fk: 80, bh: -32, bk: 70 },
  upper: { lean: -10, head: -16, fs: 168, fe: 25, bs: 20, be: 110, fh: 18, fk: 6, bh: -14, bk: 8 },

  kickChamber: { lean: -6, head: -8, fs: 60, fe: 100, bs: 45, be: 110, fh: 98, fk: 120, bh: -2, bk: 14 },
  kick: { lean: -22, head: -6, fs: 40, fe: 80, bs: 60, be: 90, fh: 96, fk: 2, bh: -6, bk: 6 },
  highKick: { lean: -34, head: -2, fs: 35, fe: 60, bs: 70, be: 70, fh: 140, fk: 2, bh: -4, bk: 4 },
  sweep: { lean: 34, head: -20, fs: 30, fe: 40, bs: 10, be: 40, fh: 82, fk: 4, bh: -20, bk: 140 },

  block: { lean: 2, head: -2, fs: 105, fe: 135, bs: 85, be: 140, fh: 22, fk: 30, bh: -26, bk: 34 },
  hurt: { lean: -24, head: -28, fs: 55, fe: 20, bs: 75, be: 30, fh: 30, fk: 34, bh: -12, bk: 40 },
  hurtLow: { lean: 40, head: 18, fs: 10, fe: 30, bs: 25, be: 30, fh: 40, fk: 60, bh: -10, bk: 60 },
  flung: { lean: -40, head: -30, fs: 120, fe: 30, bs: 150, be: 30, fh: 50, fk: 50, bh: 20, bk: 70, rot: -25 },
  // Flat on the back, head toward the attacker's side.
  down: { lean: 0, head: -6, fs: 20, fe: 30, bs: 60, be: 20, fh: 18, fk: 30, bh: 2, bk: 10, rot: -90 },
  rise: { lean: 40, head: -10, fs: 30, fe: 20, bs: 10, be: 20, fh: 95, fk: 120, bh: -15, bk: 125 },
  kneel: { lean: 18, head: 14, fs: 10, fe: 15, bs: 40, be: 20, fh: 88, fk: 92, bh: -12, bk: 115 },

  crouch: { lean: 26, head: -14, fs: 40, fe: 60, bs: 10, be: 60, fh: 75, fk: 115, bh: -10, bk: 120 },
  tuck: { lean: 30, head: -10, fs: 60, fe: 110, bs: 40, be: 110, fh: 115, fk: 135, bh: 85, bk: 135 },
  airPose: { lean: 10, head: -10, fs: 70, fe: 60, bs: -40, be: 40, fh: 60, fk: 70, bh: -20, bk: 60 },
  stomp: { lean: 12, head: -8, fs: 120, fe: 40, bs: 140, be: 40, fh: 40, fk: 10, bh: -30, bk: 50 },

  // Sword work: the weapon angle is measured against the forearm.
  drawSword: { lean: 4, head: -4, fs: 150, fe: 20, bs: 20, be: 80, fh: 25, fk: 25, bh: -20, bk: 28, w: -10 },
  swordReady: { lean: 12, head: -10, fs: 50, fe: 70, bs: 45, be: 90, fh: 30, fk: 30, bh: -22, bk: 32, w: -55 },
  slashWind: { lean: -4, head: -10, fs: 165, fe: 45, bs: 120, be: 60, fh: 28, fk: 24, bh: -22, bk: 28, w: 10 },
  slash: { lean: 26, head: -16, fs: 50, fe: 0, bs: 30, be: 90, fh: 42, fk: 45, bh: -32, bk: 20, w: 20 },
  slashLowWind: { lean: 20, head: -14, fs: -40, fe: 30, bs: 30, be: 90, fh: 45, fk: 70, bh: -30, bk: 60, w: -30 },
  slashLow: { lean: 34, head: -18, fs: 110, fe: -5, bs: -30, be: 30, fh: 55, fk: 75, bh: -40, bk: 40, w: -20 },
  dashCut: { lean: 34, head: -14, fs: 95, fe: 0, bs: -70, be: 20, fh: 62, fk: 65, bh: -55, bk: 25, w: 0 },
  sheathe: { lean: 14, head: 8, fs: 30, fe: 120, bs: 60, be: 100, fh: 30, fk: 35, bh: -20, bk: 35, w: -150 },

  // Scythe work: two-handed, the front hand low on the staff.
  scytheReady: { lean: 8, head: -8, fs: 60, fe: 40, bs: 80, be: 60, fh: 28, fk: 28, bh: -22, bk: 30, w: -20 },
  scytheRaise: { lean: -14, head: -16, fs: 170, fe: 20, bs: 160, be: 30, fh: 25, fk: 15, bh: -20, bk: 25, w: -10 },
  scytheChop: { lean: 34, head: -14, fs: 70, fe: -5, bs: 60, be: 10, fh: 50, fk: 60, bh: -40, bk: 20, w: 40 },
  scytheSweepWind: { lean: -6, head: -10, fs: -60, fe: 20, bs: -30, be: 40, fh: 30, fk: 35, bh: -22, bk: 28, w: -90 },
  scytheSweep: { lean: 24, head: -12, fs: 100, fe: 0, bs: 80, be: 20, fh: 40, fk: 40, bh: -30, bk: 22, w: 70 },
  cast: { lean: 18, head: -10, fs: 95, fe: 0, bs: 90, be: 10, fh: 38, fk: 36, bh: -28, bk: 20, w: -40 },

  // Locked in a clash: Kade two-handed with the blade up, Vorthak leaning into it.
  clashK: { lean: 30, head: -14, fs: 85, fe: 20, bs: 70, be: 40, fh: 50, fk: 50, bh: -40, bk: 15, w: -75 },
  clashV: { lean: 32, head: -20, fs: 95, fe: 25, bs: 60, be: 50, fh: 45, fk: 45, bh: -35, bk: 20 },

  // The boss's heavy moves.
  roar: { lean: -18, head: -34, fs: 120, fe: 30, bs: 140, be: 30, fh: 30, fk: 20, bh: -26, bk: 26 },
  powerUp: { lean: 8, head: 10, fs: 30, fe: 70, bs: 25, be: 75, fh: 40, fk: 50, bh: -32, bk: 52 },
  backhandWind: { lean: 10, head: -20, fs: 5, fe: 110, bs: 30, be: 40, fh: 30, fk: 30, bh: -24, bk: 30 },
  backhand: { lean: 18, head: -24, fs: 115, fe: 10, bs: 10, be: 40, fh: 34, fk: 30, bh: -28, bk: 26 },
  catch: { lean: 14, head: -14, fs: 105, fe: 30, bs: 30, be: 45, fh: 30, fk: 30, bh: -24, bk: 30 },
  throw: { lean: 30, head: -14, fs: 150, fe: 20, bs: -10, be: 40, fh: 40, fk: 36, bh: -36, bk: 20 },
  smashWind: { lean: -12, head: -20, fs: 175, fe: 30, bs: 170, be: 30, fh: 60, fk: 80, bh: 20, bk: 90 },
  smash: { lean: 40, head: -6, fs: 60, fe: 0, bs: 50, be: 0, fh: 40, fk: 60, bh: -20, bk: 70 },
  clawSwipe: { lean: 30, head: -24, fs: 70, fe: -5, bs: -10, be: 50, fh: 42, fk: 42, bh: -30, bk: 26 },
  blast: { lean: 20, head: -18, fs: 90, fe: 0, bs: 88, be: 0, fh: 38, fk: 40, bh: -32, bk: 22 },
};

export const pose = (name, overrides = {}) => {
  const base = POSES[name];
  if (!base) throw new Error(`No pose named "${name}".`);
  return { ...base, ...overrides };
};
