/**
 * The cast and how each one is drawn.
 *
 * A character is a colour scheme, a scale, the extras it wears (a scarf,
 * horns, a tail) and the weapons it can hold. Its signature colour marks
 * everything it does: smears, weapon trails and the sparks of its hits. Scarves, hair and tails are
 * short rope chains simulated frame by frame, so they trail behind motion.
 */
import { BODY, solve, toWorld } from './rig.mjs';

export const CAST = {
  kade: {
    name: 'Kade',
    scale: 1,
    color: '#15151b',
    outline: null,
    eye: '#f4f4f4',
    limb: 6.5,
    torso: 8.5,
    scarf: { color: '#2f8cff', links: 9, length: 7, width: 5 },
    weapon: 'katana',
    signature: '#2f8cff',
  },
  sora: {
    name: 'Sora',
    scale: 1,
    color: '#f3f3f7',
    outline: '#2b2b38',
    eye: '#2b2b38',
    limb: 6.5,
    torso: 8.5,
    hair: { color: '#b9c6ff', outline: '#2b2b38' },
    scarf: { color: '#8f5cff', links: 7, length: 6, width: 4 },
    weapon: 'scythe',
    signature: '#a070ff',
  },
  vorthak: {
    name: 'Vorthak',
    scale: 1.42,
    color: '#0d0b0e',
    outline: null,
    eye: '#ff2a2a',
    limb: 8.5,
    torso: 14,
    horns: true,
    claws: true,
    tail: { color: '#0d0b0e', links: 10, length: 7, width: 7 },
    weapon: null,
    signature: '#ff2a3a',
  },
};

/** A rope of points pulled along by an anchor, with gravity and a little drag. */
class Chain {
  constructor(links, length) {
    this.links = links;
    this.length = length;
    this.points = null;
  }

  update(anchor, dt, { gravity = 900, drag = 0.86, wind = 0 } = {}) {
    if (!this.points) {
      this.points = Array.from({ length: this.links + 1 }, (_, i) => ({ x: anchor.x - i * this.length, y: anchor.y, px: anchor.x - i * this.length, py: anchor.y }));
    }
    const pts = this.points;
    // A figure that jumps across the stage between frames takes its rope with it.
    if (Math.hypot(pts[0].x - anchor.x, pts[0].y - anchor.y) > 150) {
      this.points = null;
      return this.update(anchor, dt, { gravity, drag, wind });
    }
    pts[0].x = pts[0].px = anchor.x;
    pts[0].y = pts[0].py = anchor.y;
    for (let i = 1; i < pts.length; i += 1) {
      const point = pts[i];
      const vx = (point.x - point.px) * drag;
      const vy = (point.y - point.py) * drag;
      point.px = point.x;
      point.py = point.y;
      point.x += vx + wind * dt * dt;
      point.y += vy + gravity * dt * dt;
    }
    for (let pass = 0; pass < 6; pass += 1) {
      for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1];
        const b = pts[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.0001;
        const pull = (distance - this.length) / distance;
        if (i === 1) {
          b.x -= dx * pull;
          b.y -= dy * pull;
        } else {
          a.x += dx * pull * 0.5;
          a.y += dy * pull * 0.5;
          b.x -= dx * pull * 0.5;
          b.y -= dy * pull * 0.5;
        }
      }
      pts[0].x = anchor.x;
      pts[0].y = anchor.y;
    }
  }
}

/** One character on stage: its look plus the ropes that follow it. */
export class Actor {
  constructor(id) {
    this.id = id;
    this.look = CAST[id];
    this.scarf = this.look.scarf ? new Chain(this.look.scarf.links, this.look.scarf.length * this.look.scale) : null;
    this.tail = this.look.tail ? new Chain(this.look.tail.links, this.look.tail.length * this.look.scale) : null;
    this.solved = null;
    this.place = null;
  }

  /** How big the figure is drawn: its own scale, times any size its keys give it. */
  scaleOf(state = this.state) {
    return this.look.scale * (state?.size ?? 1);
  }

  /** Solve the pose at this frame and move the ropes along with it. */
  update(state, dt) {
    const solved = solve(state.pose, this.scaleOf(state), BODY);
    this.solved = solved;
    this.state = state;
    this.place = { x: state.x, y: state.y, facing: state.facing };
    const wind = -state.vx * 3;
    if (this.scarf) this.scarf.update(toWorld(solved.neck, this.place), dt, { gravity: 500, drag: 0.9, wind: wind - state.facing * 260 });
    if (this.tail) {
      const hip = toWorld({ x: -4 * this.scaleOf(state), y: 2 }, this.place);
      // A tail lifts and sways behind the figure rather than dragging on the floor.
      this.sway = (this.sway ?? 0) + dt;
      const sway = Math.sin(this.sway * 2.4) * 160;
      this.tail.update(hip, dt, { gravity: 140 + sway, drag: 0.8, wind: wind - state.facing * 520 });
    }
  }

  /** The world positions of the weapon's grip and tip, for trails and hits. */
  weaponLine() {
    if (!this.state?.weapon || !this.look.weapon) return null;
    const s = this.solved;
    const { length } = weaponShape(this.look.weapon, this.scaleOf());
    const grip = s.front.hand;
    const angle = (s.weaponA * Math.PI) / 180;
    const tip = { x: grip.x + Math.sin(angle) * length, y: grip.y - Math.cos(angle) * length };
    const back = { x: grip.x - Math.sin(angle) * length * 0.12, y: grip.y + Math.cos(angle) * length * 0.12 };
    return { grip: toWorld(grip, this.place), tip: toWorld(tip, this.place), back: toWorld(back, this.place) };
  }

  /** The colour that marks this figure right now: its key's signature colour, or its own. */
  signature() {
    return this.state?.signature ?? this.look.signature;
  }

  /** Where the eye sits in the world, for the boss's glowing eye trail. */
  eye() {
    const s = this.solved;
    const { up, fwd } = headFrame(s);
    const r = s.headR;
    return toWorld({ x: s.head.x + fwd.x * r * 0.5 + up.x * r * 0.12, y: s.head.y + fwd.y * r * 0.5 + up.y * r * 0.12 }, this.place);
  }

  /** A world point on the body, by name, for effects to aim at. */
  point(name) {
    if (name === 'tip') return this.weaponLine()?.tip ?? this.point('fist');
    const s = this.solved;
    const local = {
      head: s.head,
      chest: s.chest,
      hip: s.hip,
      fist: s.front.hand,
      backFist: s.back.hand,
      foot: s.frontLeg.ankle,
      backFoot: s.backLeg.ankle,
    }[name];
    return toWorld(local, this.place);
  }

  /** Draw the figure in another state, such as an in-between for a smear. */
  drawPose(ctx, state, options) {
    const keep = { solved: this.solved, state: this.state, place: this.place };
    this.solved = solve(state.pose, this.scaleOf(state), BODY);
    this.state = state;
    this.place = { x: state.x, y: state.y, facing: state.facing };
    this.draw(ctx, { ...options, ropes: false });
    Object.assign(this, keep);
  }

  /** `silhouette` draws the figure flat in one colour, without its details. */
  draw(ctx, { glow = 0, alpha = 1, ropes = true, silhouette = null } = {}) {
    const look = this.look;
    const s = this.solved;
    const k = this.scaleOf();
    ctx.save();
    ctx.globalAlpha *= alpha * (this.state.opacity ?? 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (glow > 0) {
      ctx.shadowColor = this.state.auraColor ?? '#ff2040';
      ctx.shadowBlur = 30 * glow;
    }

    // Ropes are in world space already.
    if (ropes && this.tail) drawRope(ctx, this.tail.points, look.tail.color, look.tail.width * k, 1.5 * k);
    if (ropes && this.scarf) drawRope(ctx, this.scarf.points, this.state.signature ?? look.scarf.color, look.scarf.width * k, 1 * k, look.outline);

    ctx.translate(this.place.x, this.place.y);
    ctx.scale(this.place.facing, 1);

    const passes = silhouette
      ? [{ color: silhouette, extra: 0 }]
      : look.outline
        ? [{ color: look.outline, extra: 3 }, { color: look.color, extra: 0 }]
        : [{ color: look.color, extra: 0 }];
    const limbs = [
      ['backArm', () => [s.chest, s.back.elbow, s.back.hand], look.limb],
      ['backLeg', () => [s.hip, s.backLeg.knee, s.backLeg.ankle, s.backLeg.toe], look.limb],
    ];
    const frontLimbs = [
      ['frontLeg', () => [s.hip, s.frontLeg.knee, s.frontLeg.ankle, s.frontLeg.toe], look.limb],
      ['frontArm', () => [s.chest, s.front.elbow, s.front.hand], look.limb],
    ];

    for (const pass of passes) {
      // The back limbs read a touch darker so the figure has depth.
      for (const [, points, width] of limbs) {
        stroke(ctx, points(), width * k + pass.extra, pass.extra || silhouette ? pass.color : shade(pass.color, look.outline ? -0.12 : 0.18));
      }
      stroke(ctx, [s.hip, s.chest], look.torso * k + pass.extra, pass.color);
      stroke(ctx, [s.chest, s.neck], look.limb * k + pass.extra, pass.color);
      ctx.beginPath();
      ctx.arc(s.head.x, s.head.y, s.headR + pass.extra / 2, 0, Math.PI * 2);
      ctx.fillStyle = pass.color;
      ctx.fill();
    }
    if (!silhouette) {
      if (look.horns) drawHorns(ctx, s, k, 1 + 0.5 * (this.state.demon ?? 0));
      if (look.hair) drawHair(ctx, s, k, look.hair);
      drawEye(ctx, s, look, glow);
    }

    for (const pass of passes) {
      for (const [, points, width] of frontLimbs) stroke(ctx, points(), width * k + pass.extra, pass.color);
    }
    if (look.claws && !silhouette) {
      drawClaws(ctx, s.front.hand, s.front.foreA, k, look.color);
      drawClaws(ctx, s.back.hand, s.back.foreA, k, shade(look.color, 0.18));
    }
    if (this.state.weapon && look.weapon && !silhouette) drawWeapon(ctx, look.weapon, s.front.hand, s.weaponA, k, this.state.weaponGlow ?? 0, this.signature());
    const chains = [
      [s.chest, s.back.elbow, s.back.hand],
      [s.hip, s.backLeg.knee, s.backLeg.ankle],
      [s.hip, s.chest, s.neck],
      [s.hip, s.frontLeg.knee, s.frontLeg.ankle],
      [s.chest, s.front.elbow, s.front.hand],
    ];
    // The demon form: molten red veins glowing through every limb.
    // Ice smothers the fire: the veins fade as the figure freezes.
    const demon = (this.state.demon ?? 0) * (1 - 0.85 * Math.min(1, this.state.frozen ?? 0));
    if (demon > 0.01 && !silhouette) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, demon);
      ctx.shadowColor = '#ff1a2a';
      ctx.shadowBlur = 14;
      for (const chain of chains) stroke(ctx, chain, 2.2 * k, '#ff3a3a');
      ctx.restore();
    }
    // Frozen: frost over the whole body, then a shell of ice around it.
    const frozen = this.state.frozen ?? 0;
    if (frozen > 0.01 && !silhouette) {
      ctx.save();
      // No aura glow bleeds into the ice.
      ctx.shadowBlur = 0;
      ctx.globalAlpha *= Math.min(1, frozen) * 0.85;
      for (const chain of chains) stroke(ctx, chain, look.limb * k + 1, '#d6f2ff');
      ctx.beginPath();
      ctx.arc(s.head.x, s.head.y, s.headR + 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#d6f2ff';
      ctx.fill();
      if (frozen > 0.4) drawIceShell(ctx, s, k, Math.min(1, (frozen - 0.4) / 0.6));
      ctx.restore();
    }
    ctx.restore();
  }
}

function stroke(ctx, points, width, color) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawRope(ctx, points, color, width, taper, outline) {
  if (!points) return;
  for (const pass of outline ? [outline, color] : [color]) {
    for (let i = 1; i < points.length; i += 1) {
      const t = i / points.length;
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.lineWidth = Math.max(1.5, width * (1 - t * 0.7)) + (pass === outline ? 2.5 : 0);
      ctx.strokeStyle = pass;
      ctx.stroke();
    }
  }
}

function headFrame(s) {
  const a = (s.neckA * Math.PI) / 180;
  // Along the neck (up) and across it (forward).
  return { up: { x: Math.sin(a), y: -Math.cos(a) }, fwd: { x: Math.cos(a), y: Math.sin(a) } };
}

function drawEye(ctx, s, look, glow) {
  const { up, fwd } = headFrame(s);
  const r = s.headR;
  const x = s.head.x + fwd.x * r * 0.5 + up.x * r * 0.12;
  const y = s.head.y + fwd.y * r * 0.5 + up.y * r * 0.12;
  ctx.save();
  if (look.horns) {
    ctx.shadowColor = '#ff1a1a';
    ctx.shadowBlur = 10 + glow * 18;
  }
  ctx.fillStyle = look.eye;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.3, r * 0.13, Math.atan2(fwd.y, fwd.x) - 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHorns(ctx, s, k, grow = 1) {
  const { up, fwd } = headFrame(s);
  const r = s.headR * grow;
  const at = (u, f) => ({ x: s.head.x + up.x * u + fwd.x * f, y: s.head.y + up.y * u + fwd.y * f });
  ctx.fillStyle = '#0d0b0e';
  for (const side of [-0.35, 0.25]) {
    const base1 = at(r * 0.6, r * (side - 0.25));
    const base2 = at(r * 0.75, r * (side + 0.25));
    const mid = at(r * 1.8, r * (side - 0.6));
    const tip = at(r * 2.5, r * (side - 1.5));
    ctx.beginPath();
    ctx.moveTo(base1.x, base1.y);
    ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
    ctx.quadraticCurveTo(at(r * 1.7, r * side).x, at(r * 1.7, r * side).y, base2.x, base2.y);
    ctx.closePath();
    ctx.fill();
  }
  // A ridge of spikes down the back of the neck.
  for (let i = 0; i < 3; i += 1) {
    const base = at(r * (0.2 - i * 0.55), -r * 0.9);
    const tip = at(r * (0.1 - i * 0.55), -r * (1.6 - i * 0.1));
    ctx.beginPath();
    ctx.moveTo(base.x + up.x * 4 * k, base.y + up.y * 4 * k);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(base.x - up.x * 4 * k, base.y - up.y * 4 * k);
    ctx.fill();
  }
}

function drawHair(ctx, s, k, hair) {
  const { up, fwd } = headFrame(s);
  const r = s.headR;
  const at = (u, f) => ({ x: s.head.x + up.x * u + fwd.x * f, y: s.head.y + up.y * u + fwd.y * f });
  const spikes = [
    [at(r * 0.9, r * 0.4), at(r * 1.5, r * 0.2)],
    [at(r * 1.0, -r * 0.1), at(r * 1.75, -r * 0.6)],
    [at(r * 0.7, -r * 0.6), at(r * 1.3, -r * 1.5)],
    [at(r * 0.1, -r * 0.95), at(r * 0.2, -r * 1.9)],
  ];
  ctx.beginPath();
  ctx.moveTo(at(r * 0.3, r * 0.95).x, at(r * 0.3, r * 0.95).y);
  for (const [base, tip] of spikes) {
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(base.x, base.y);
  }
  ctx.lineTo(at(-r * 0.4, -r * 0.95).x, at(-r * 0.4, -r * 0.95).y);
  ctx.closePath();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = hair.outline;
  ctx.stroke();
  ctx.fillStyle = hair.color;
  ctx.fill();
}

function drawClaws(ctx, hand, foreA, k, color) {
  const a = (foreA * Math.PI) / 180;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5 * k;
  for (const spread of [-0.5, 0, 0.5]) {
    const angle = a + spread;
    ctx.beginPath();
    ctx.moveTo(hand.x, hand.y);
    ctx.lineTo(hand.x + Math.sin(angle) * 9 * k, hand.y - Math.cos(angle) * 9 * k);
    ctx.stroke();
  }
}

export function weaponShape(kind, scale) {
  return kind === 'katana' ? { length: 68 * scale } : { length: 92 * scale };
}

function drawWeapon(ctx, kind, grip, angleDeg, k, glow, glowColor = '#3a9bff') {
  const a = (angleDeg * Math.PI) / 180;
  const dir = { x: Math.sin(a), y: -Math.cos(a) };
  const side = { x: Math.cos(a), y: Math.sin(a) };
  const { length } = weaponShape(kind, k);
  const at = (along, across = 0) => ({ x: grip.x + dir.x * along + side.x * across, y: grip.y + dir.y * along + side.y * across });
  ctx.save();
  if (kind === 'katana') {
    // Handle, guard, then a slightly curved blade.
    stroke(ctx, [at(-9), at(4)], 4.5, '#1a1a1f');
    stroke(ctx, [at(4, -5), at(4, 5)], 3, '#c9a227');
    if (glow > 0) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 18 * glow;
    }
    ctx.beginPath();
    const base = at(5);
    const mid = at(length * 0.6, 2.5);
    const tip = at(length, 5);
    ctx.moveTo(base.x, base.y);
    ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2a2a30';
    ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#e8ecf2';
    ctx.stroke();
  } else {
    // A long staff and a crescent blade at the top, facing forward.
    stroke(ctx, [at(-length * 0.25), at(length)], 5, '#2b2b38');
    stroke(ctx, [at(-length * 0.25), at(length)], 3, '#5b4a7a');
    if (glow > 0) {
      ctx.shadowColor = '#a070ff';
      ctx.shadowBlur = 22 * glow;
    }
    const root = at(length * 0.97);
    const c1 = at(length * 1.12, 26);
    const tip = at(length * 0.72, 52);
    const c2 = at(length * 0.98, 22);
    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    ctx.quadraticCurveTo(c1.x, c1.y, tip.x, tip.y);
    ctx.quadraticCurveTo(c2.x, c2.y, at(length * 0.9).x, at(length * 0.9).y);
    ctx.closePath();
    ctx.fillStyle = '#d9d4ec';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2b2b38';
    ctx.stroke();
  }
  ctx.restore();
}

/** A jagged crystal of ice around a frozen figure, `amount` from 0 (forming) to 1 (whole). */
function drawIceShell(ctx, s, k, amount) {
  const points = [s.head, s.chest, s.hip, s.front.hand, s.back.hand, s.frontLeg.ankle, s.backLeg.ankle, s.front.elbow, s.back.elbow];
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const pad = 14 * k;
  const left = Math.min(...xs) - pad;
  const right = Math.max(...xs) + pad;
  const top = Math.min(...ys) - s.headR - pad;
  const bottom = Math.max(...ys) + 4;
  // It grows up from the feet as it forms.
  const rise = bottom - (bottom - top) * amount;
  const outline = [
    [left + 6, bottom], [left - 4, bottom - (bottom - top) * 0.3], [left + 8, bottom - (bottom - top) * 0.55],
    [left, bottom - (bottom - top) * 0.8], [left + (right - left) * 0.3, top], [left + (right - left) * 0.55, top + 10],
    [left + (right - left) * 0.75, top - 6], [right, bottom - (bottom - top) * 0.75], [right - 8, bottom - (bottom - top) * 0.45],
    [right + 4, bottom - (bottom - top) * 0.2], [right - 4, bottom],
  ].map(([x, y]) => [x, Math.max(y, rise)]);
  ctx.beginPath();
  outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  const fill = ctx.createLinearGradient(left, top, right, bottom);
  fill.addColorStop(0, 'rgba(225,245,255,0.55)');
  fill.addColorStop(1, 'rgba(150,215,255,0.35)');
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // A few facet lines catching the light.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(left + (right - left) * 0.3, Math.max(top + 20, rise));
  ctx.lineTo(left + (right - left) * 0.45, bottom - 20);
  ctx.moveTo(left + (right - left) * 0.7, Math.max(top + 30, rise));
  ctx.lineTo(left + (right - left) * 0.6, bottom - 40);
  ctx.stroke();
}

/** Lighten (positive) or darken (negative) a hex colour. */
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const channel = shift => {
    const value = (n >> shift) & 255;
    const target = amount >= 0 ? 255 : 0;
    return Math.round(value + (target - value) * Math.abs(amount));
  };
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}
