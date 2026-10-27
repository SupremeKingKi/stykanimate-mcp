/**
 * Effects: impact bursts, sparks, dust, shockwaves, slash lines, energy
 * waves and speech. They live in world space unless they say otherwise and
 * run on video time, so they keep moving through a hit-stop freeze.
 */
import { GROUND } from './stage.mjs';

/** A small seeded random source, so every render of a scene is the same. */
export function random(seed = 7) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = {
  hit: { core: '#ffffff', glow: 'rgba(255,214,90,', spark: '#ffd65a' },
  heavy: { core: '#ffffff', glow: 'rgba(255,170,60,', spark: '#ffb43c' },
  block: { core: '#ffffff', glow: 'rgba(150,200,255,', spark: '#cfe6ff' },
  clang: { core: '#ffffff', glow: 'rgba(255,240,200,', spark: '#fff2c0' },
  slash: { core: '#ffffff', glow: 'rgba(255,90,90,', spark: '#ff8080' },
  dark: { core: '#ffd0d8', glow: 'rgba(255,30,70,', spark: '#ff3050' },
  purple: { core: '#ffffff', glow: 'rgba(160,100,255,', spark: '#c9a6ff' },
};

export class Effects {
  constructor(seed = 11) {
    this.rand = random(seed);
    this.world = [];
    this.screen = [];
    // Marks left on the floor: they stay for the rest of the scene.
    this.decals = [];
    this.sprites = new Map();
  }

  /** Give the effects the baked clip sprites they may play. */
  useSprites(sprites) {
    this.sprites = sprites;
  }

  update(dt) {
    for (const list of [this.world, this.screen]) {
      for (const effect of list) effect.age += dt;
      for (let i = list.length - 1; i >= 0; i -= 1) if (list[i].age >= list[i].life) list.splice(i, 1);
    }
    for (const effect of this.world) effect.step?.(dt);
  }

  drawDecals(ctx) {
    for (const decal of this.decals) decal.draw(ctx);
  }

  drawWorld(ctx) {
    for (const effect of this.world) effect.draw(ctx, effect.age / effect.life);
  }

  drawScreen(ctx, view) {
    for (const effect of this.screen) effect.draw(ctx, effect.age / effect.life, view);
  }

  /** A burst of light where a blow lands. */
  impact(x, y, { kind = 'hit', size = 1, angle = 0, tint = null } = {}) {
    // Most blows are small. Save the big glowing burst for the ones that matter.
    if (size < 1.3 && !['heavy', 'dark'].includes(kind)) return this.lightImpact(x, y, { size, tint: tint ?? (PALETTE[kind] ?? PALETTE.hit).spark });
    const color = PALETTE[kind] ?? PALETTE.hit;
    const r = this.rand;
    const spikes = Array.from({ length: 10 + Math.round(size * 4) }, () => ({ a: r() * Math.PI * 2, l: 0.5 + r() * 0.8 }));
    this.world.push({
      age: 0,
      life: 0.16 + size * 0.08,
      draw(ctx, t) {
        const grow = 1 - (1 - t) ** 3;
        const radius = (22 + 36 * size) * (0.4 + grow);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.6);
        glow.addColorStop(0, `${color.glow}${0.95 * (1 - t)})`);
        glow.addColorStop(1, `${color.glow}0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, radius * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.fillStyle = color.core;
        ctx.globalAlpha = 1 - t * t;
        // Thin spikes radiating out, like a comic-book impact star.
        ctx.beginPath();
        for (const spike of spikes) {
          const length = radius * spike.l * 1.5;
          const a = spike.a;
          ctx.moveTo(x + Math.cos(a - 0.08) * radius * 0.25, y + Math.sin(a - 0.08) * radius * 0.25);
          ctx.lineTo(x + Math.cos(a) * length, y + Math.sin(a) * length);
          ctx.lineTo(x + Math.cos(a + 0.08) * radius * 0.25, y + Math.sin(a + 0.08) * radius * 0.25);
        }
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.32 * (1 - t), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    });
    this.sparks(x, y, { count: Math.round(8 + size * 10), color: tint ?? color.spark, speed: 260 + size * 220, angle, spread: kind === 'block' || kind === 'clang' ? 1.4 : Math.PI });
    if (size >= 1.4) this.ring(x, y, { color: color.glow, size });
  }

  /** A small four-point star, a pinch of colour and a few dark specks. */
  lightImpact(x, y, { size = 1, tint = '#ffffff' } = {}) {
    const r = this.rand;
    const turn = r() * Math.PI;
    const radius = 14 + 12 * size;
    this.world.push({
      age: 0,
      life: 0.14,
      draw(ctx, t) {
        const grow = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(turn);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = tint;
        ctx.globalAlpha = 0.35 * grow;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 4; i += 1) {
          const a = (i * Math.PI) / 2;
          const long = radius * (i % 2 ? 0.6 : 1) * grow;
          ctx.lineTo(Math.cos(a) * long, Math.sin(a) * long);
          ctx.lineTo(Math.cos(a + Math.PI / 4) * radius * 0.16, Math.sin(a + Math.PI / 4) * radius * 0.16);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      },
    });
    this.sparks(x, y, { count: 4, color: tint, speed: 240, life: 0.22 });
    this.sparks(x, y, { count: 5, color: '#25252c', speed: 200, life: 0.35, width: 3, composite: 'source-over' });
  }

  /** Short bright streaks thrown out from a point. */
  sparks(x, y, { count = 12, color = '#ffd65a', speed = 320, angle = 0, spread = Math.PI, gravity = 700, life = 0.35, width = 2.2, composite = 'lighter' } = {}) {
    const r = this.rand;
    for (let i = 0; i < count; i += 1) {
      const a = angle + (r() - 0.5) * 2 * spread;
      const v = speed * (0.4 + r() * 0.8);
      const p = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v };
      this.world.push({
        age: 0,
        life: life * (0.6 + r() * 0.7),
        step(dt) {
          p.vy += gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y > GROUND) {
            p.y = GROUND;
            p.vy *= -0.35;
            p.vx *= 0.6;
          }
        },
        draw(ctx, t) {
          ctx.save();
          ctx.globalCompositeOperation = composite;
          ctx.strokeStyle = color;
          ctx.globalAlpha = 1 - t;
          ctx.lineWidth = width;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
          ctx.restore();
        },
      });
    }
  }

  /** An expanding ring, for heavy blows and shouts. */
  ring(x, y, { color = 'rgba(255,255,255,', size = 1, life = 0.4, squash = 0.55 } = {}) {
    this.world.push({
      age: 0,
      life,
      draw(ctx, t) {
        const radius = 30 + 160 * size * (1 - (1 - t) ** 2);
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = `${color}1)`;
        ctx.lineWidth = 10 * (1 - t) + 1;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * squash, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },
    });
  }

  /** Dust kicked up from the floor. */
  dust(x, { size = 1, count = 8, dir = 0 } = {}) {
    const r = this.rand;
    for (let i = 0; i < count; i += 1) {
      const p = { x: x + (r() - 0.5) * 30 * size, y: GROUND - 4, vx: (dir || (r() - 0.5) * 2) * (60 + r() * 180) * size, vy: -(20 + r() * 70) * size, s: (8 + r() * 12) * size };
      this.world.push({
        age: 0,
        life: 0.6 + r() * 0.5,
        step(dt) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.93;
          p.vy *= 0.93;
        },
        draw(ctx, t) {
          ctx.save();
          ctx.globalAlpha = 0.45 * (1 - t);
          ctx.fillStyle = '#e9e7e2';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * (0.6 + t * 1.2), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        },
      });
    }
  }

  /** Chips of stone thrown up by a slam. */
  debris(x, { count = 14, size = 1 } = {}) {
    const r = this.rand;
    for (let i = 0; i < count; i += 1) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
      const v = (250 + r() * 450) * size;
      const p = { x: x + (r() - 0.5) * 40, y: GROUND - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, spin: r() * 6, s: 3 + r() * 5 };
      this.world.push({
        age: 0,
        life: 0.9 + r() * 0.4,
        step(dt) {
          p.vy += 1400 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y > GROUND) {
            p.y = GROUND;
            p.vy *= -0.3;
            p.vx *= 0.5;
          }
          p.spin += dt * 8;
        },
        draw(ctx, t) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, (1 - t) * 3);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin);
          ctx.fillStyle = '#6d717a';
          ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7);
          ctx.restore();
        },
      });
    }
  }

  /** Embers rising off a figure that is powering up. */
  embers(x, y, { color = '#ff3050', count = 3, spread = 40 } = {}) {
    const r = this.rand;
    for (let i = 0; i < count; i += 1) {
      const p = { x: x + (r() - 0.5) * spread * 2, y: y + (r() - 0.2) * spread, vx: (r() - 0.5) * 30, vy: -(80 + r() * 160) };
      this.world.push({
        age: 0,
        life: 0.5 + r() * 0.6,
        step(dt) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        },
        draw(ctx, t) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = color;
          ctx.fillRect(p.x - 1.5, p.y - 4, 3, 8 * (1 - t) + 2);
          ctx.restore();
        },
      });
    }
  }

  /** A clean cut that opens across a target after a fast draw. */
  slashLine(x1, y1, x2, y2, { color = '#ffffff', glow = '#ff3b3b', life = 0.45, width = 7 } = {}) {
    this.world.push({
      age: 0,
      life,
      draw(ctx, t) {
        const open = Math.min(1, t * 5);
        const fade = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
        const mx = x1 + (x2 - x1) * open;
        const my = y1 + (y2 - y1) * open;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.globalAlpha = fade;
        ctx.shadowColor = glow;
        ctx.shadowBlur = 24;
        ctx.strokeStyle = glow;
        ctx.lineWidth = width * 2.2 * (1 - t * 0.6);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = width * (1 - t * 0.7);
        ctx.stroke();
        ctx.restore();
      },
    });
  }

  /** A crescent of energy flying from x1 to x2 over `life` seconds. */
  wave(x1, x2, y, { color = 'rgba(170,110,255,', life = 0.3, size = 1 } = {}) {
    const dir = Math.sign(x2 - x1) || 1;
    const effects = this;
    this.world.push({
      age: 0,
      life,
      step() {
        if (this.age > 0.02) {
          const x = x1 + (x2 - x1) * (this.age / life);
          effects.sparks(x - dir * 20, y + (effects.rand() - 0.5) * 60, { count: 1, color: '#c9a6ff', speed: 80, angle: dir > 0 ? Math.PI : 0, spread: 0.5, gravity: 0, life: 0.3 });
        }
      },
      draw(ctx, t) {
        const x = x1 + (x2 - x1) * t;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(dir * size, size);
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = `${color}1)`;
        ctx.shadowBlur = 30;
        ctx.fillStyle = `${color}0.85)`;
        ctx.beginPath();
        ctx.moveTo(-6, -58);
        ctx.quadraticCurveTo(46, 0, -6, 58);
        ctx.quadraticCurveTo(20, 0, -6, -58);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(0, -44);
        ctx.quadraticCurveTo(34, 0, 0, 44);
        ctx.quadraticCurveTo(18, 0, 0, -44);
        ctx.fill();
        ctx.restore();
      },
    });
  }

  /**
   * Play a baked clip at a point. The clip's pivot lands on (x, y); `tint`
   * recolours it, `additive` makes it glow.
   */
  sprite(name, x, y, { scale = 1, rotation = 0, flip = 1, tint = null, alpha = 1, speed = 1, additive = false, scaleY = null } = {}) {
    const sprite = this.sprites.get(name);
    if (!sprite) throw new Error(`No baked sprite named "${name}". Run node fight/bake-clips.mjs.`);
    const image = tint ? sprite.tinted(tint) : sprite.image;
    const { meta } = sprite;
    this.world.push({
      age: 0,
      life: meta.frames / (meta.fps * speed),
      draw(ctx, t) {
        const frame = Math.min(meta.frames - 1, Math.floor(t * meta.frames));
        ctx.save();
        if (additive) ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(scale * flip, scaleY ?? scale);
        ctx.drawImage(image, frame * meta.width, 0, meta.width, meta.height, -meta.pivot.x, -meta.pivot.y, meta.width, meta.height);
        ctx.restore();
      },
    });
  }

  /** Cracks in the floor where something hit it hard. They stay. */
  crack(x, { size = 1, crater = false } = {}) {
    const r = this.rand;
    const lines = Array.from({ length: 6 + Math.round(size * 4) }, () => {
      const dir = r() < 0.5 ? -1 : 1;
      const points = [[0, 0]];
      let px = 0;
      let py = 0;
      const steps = 3 + Math.floor(r() * 4);
      for (let i = 0; i < steps; i += 1) {
        px += dir * (10 + r() * 30) * size;
        py += (r() - 0.35) * 6 * size;
        points.push([px, Math.max(-3, Math.min(14, py))]);
      }
      return points;
    });
    this.decals.push({
      draw(ctx) {
        ctx.save();
        ctx.translate(x, GROUND);
        if (crater) {
          const pit = ctx.createRadialGradient(0, 4, 2, 0, 4, 70 * size);
          pit.addColorStop(0, 'rgba(40,42,50,0.55)');
          pit.addColorStop(1, 'rgba(40,42,50,0)');
          ctx.fillStyle = pit;
          ctx.beginPath();
          ctx.ellipse(0, 4, 70 * size, 12 * size, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(45,47,56,0.75)';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        for (const points of lines) {
          ctx.beginPath();
          points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
          ctx.stroke();
        }
        ctx.restore();
      },
    });
  }

  /** A full-frame flash of colour. */
  flash({ color = '255,255,255', life = 0.25, strength = 0.85 } = {}) {
    this.screen.push({
      age: 0,
      life,
      draw(ctx, t, view) {
        ctx.fillStyle = `rgba(${color},${strength * (1 - t) ** 2})`;
        ctx.fillRect(0, 0, view.width, view.height);
      },
    });
  }

  /** Streaks across the frame that sell a burst of speed. */
  speedLines({ life = 0.4, dir = 1, count = 26 } = {}) {
    const r = this.rand;
    const lines = Array.from({ length: count }, () => ({ y: r(), l: 0.2 + r() * 0.5, o: r(), w: 1 + r() * 3 }));
    this.screen.push({
      age: 0,
      life,
      draw(ctx, t, view) {
        ctx.save();
        ctx.globalAlpha = 0.5 * Math.sin(Math.PI * t);
        ctx.fillStyle = '#ffffff';
        for (const line of lines) {
          const x = (((line.o + t * 2.5 * dir) % 1) + 1) % 1;
          ctx.fillRect(x * view.width * 1.4 - view.width * 0.2, line.y * view.height, line.l * view.width * 0.5, line.w);
        }
        ctx.restore();
      },
    });
  }
}

/**
 * Speech that types itself out above a speaker's head.
 * `anchor` is a function giving the head's screen position each frame.
 */
export function drawSpeech(ctx, text, progress, anchor, { color = '#16161c', size = 27 } = {}) {
  const shown = text.slice(0, Math.ceil(text.length * Math.min(1, progress * 3.2)));
  const fade = progress > 0.88 ? (1 - progress) / 0.12 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.font = `bold ${size}px Bahnschrift`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  const x = Math.min(Math.max(anchor.x, 200), ctx.canvas.width - 200);
  const y = Math.max(anchor.y - 30, 60);
  ctx.strokeText(shown, x, y);
  ctx.fillStyle = color;
  ctx.fillText(shown, x, y);
  ctx.restore();
}
