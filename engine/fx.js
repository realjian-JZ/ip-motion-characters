/* Particle FX layer (references/game-juice.md).
 * Deterministic: every particle is a closed-form function of (event seed, age), so a motion's FX render
 * identically every time; the playground spawns live events into the same system.
 *
 * Event: { t, type, n = 1, x = 0, y = -210, dir = -90, spread = 120, speed = [260, 420], gravity = 1200,
 *          life = 0.8, size = 1, label, color, seed, to: [x, y] (fly to a counter after 0.3s) }
 * Types: coin · star · heart · spark · confetti · ring · text · lines · rays
 * Coordinates are stage coordinates (feet centre = 0,0; y up negative). `rays` draw behind the character. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const CONFETTI = ['#FF5C8A', '#FFC93C', '#2D9CDB', '#4CD07D', '#8A4FD8', '#FF8A3D'];

  const rand = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const starPts = (r) => {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
      p.push(`${(rr * Math.cos(a)).toFixed(1)},${(rr * Math.sin(a)).toFixed(1)}`);
    }
    return p.join(' ');
  };
  const SHAPE = {
    coin: () => '<ellipse rx="12" ry="12" fill="#FFC93C" stroke="#E0A91F" stroke-width="3"/><rect x="-3" y="-7" width="6" height="14" rx="3" fill="#E0A91F"/>',
    star: () => `<polygon points="${starPts(13)}" fill="#FFD84D" stroke="#F2B230" stroke-width="2" stroke-linejoin="round"/>`,
    heart: () => '<path d="M 0 10 C -16 0 -14 -12 -6 -12 C -2 -12 0 -9 0 -7 C 0 -9 2 -12 6 -12 C 14 -12 16 0 0 10 Z" fill="#FF5C8A"/>',
    spark: (p) => `<circle r="5" fill="${p.color || '#FFE38A'}"/>`,
    confetti: (p) => `<rect x="-4" y="-7" width="8" height="14" rx="2" fill="${p.color}"/>`,
    ring: (p) => `<circle r="34" fill="none" stroke="${p.color || '#FFFFFF'}" stroke-width="6"/>`,
    text: (p) => `<text text-anchor="middle" dominant-baseline="middle" font-family="Arial Rounded MT Bold, Microsoft YaHei, PingFang SC, sans-serif" font-weight="900" font-size="${(36 * (p.size || 1)).toFixed(0)}" fill="${p.color || '#FF8A3D'}" stroke="#FFFFFF" stroke-width="7" paint-order="stroke" stroke-linejoin="round">${p.label}</text>`,
    lines: () => '<rect x="-3" y="-26" width="6" height="52" rx="3" fill="#FFFFFF" opacity="0.85"/>',
    rays: () => {
      let s = '';
      for (let i = 0; i < 12; i++) s += `<path d="M 0 0 L ${(-38).toFixed(0)} -420 L 38 -420 Z" fill="#FFD84D" transform="rotate(${i * 30})"/>`;
      return s;
    },
  };

  // expand one event into particles with their own fixed randomness
  function expand(ev) {
    const r = rand(ev.seed ?? Math.round(ev.t * 1000) + 7);
    const n = ev.n ?? 1, out = [];
    for (let i = 0; i < n; i++) {
      const a = (((ev.dir ?? -90) + (r() - 0.5) * (ev.spread ?? 120)) * Math.PI) / 180;
      const [s0, s1] = ev.speed || [260, 420];
      const sp = s0 + r() * (s1 - s0);
      out.push({
        ev, type: ev.type, t0: ev.t + (ev.stagger || 0) * i, x0: ev.x ?? 0, y0: ev.y ?? -210,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: ev.gravity ?? 1200,
        life: (ev.life ?? 0.8) * (0.85 + r() * 0.3), spin: (r() - 0.5) * 720, size: (ev.size ?? 1) * (0.85 + r() * 0.3),
        // only confetti gets a random colour; rings / sparks / text keep their own defaults
        phase: r() * 6.28, angle: a, color: ev.color || (ev.type === 'confetti' ? CONFETTI[Math.floor(r() * CONFETTI.length)] : undefined), label: ev.label,
        to: ev.to,
      });
    }
    return out;
  }

  // closed-form state at age a (0..life): x, y, rotation, scale x/y, opacity
  function state(p, a) {
    const u = a / p.life, fade = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    let x = p.x0 + p.vx * a, y = p.y0 + p.vy * a + 0.5 * p.g * a * a, r = p.spin * a, sx = p.size, sy = p.size, o = fade;
    switch (p.type) {
      case 'coin': {
        sx *= Math.max(0.15, Math.abs(Math.cos(a * 14 + p.phase))); // spinning coin
        r = 0;
        if (p.to && a > 0.3) {
          // turn and fly to the counter (ease-in), full opacity until it arrives
          const k = Math.min(1, (a - 0.3) / (p.life - 0.3)), e = k * k;
          const bx = p.x0 + p.vx * 0.3, by = p.y0 + p.vy * 0.3 + 0.5 * p.g * 0.09;
          x = bx + (p.to[0] - bx) * e;
          y = by + (p.to[1] - by) * e;
          o = k > 0.95 ? 0 : 1;
          sx *= 1 - 0.4 * e;
          sy *= 1 - 0.4 * e;
        }
        break;
      }
      case 'spark': sx = sy = p.size * (1 - u); o = 1; break;
      case 'confetti': x += Math.sin(a * 8 + p.phase) * 14; sx *= Math.abs(Math.cos(a * 9 + p.phase)) * 0.8 + 0.2; break;
      case 'ring': x = p.x0; y = p.y0; r = 0; sx = sy = p.size * (0.3 + 1.5 * (1 - (1 - u) * (1 - u))); o = 1 - u; break;
      case 'text': {
        x = p.x0; r = 0;
        const pop = a < 0.12 ? (a / 0.12) * 1.35 : a < 0.24 ? 1.35 - ((a - 0.12) / 0.12) * 0.35 : 1;
        sx = sy = p.size * pop;
        y = p.y0 - 70 * (1 - (1 - u) * (1 - u));
        o = u > 0.65 ? 1 - (u - 0.65) / 0.35 : 1;
        break;
      }
      case 'lines': {
        const d = 150 + 220 * u;
        x = p.x0 + Math.cos(p.angle) * d; y = p.y0 + Math.sin(p.angle) * d;
        r = (p.angle * 180) / Math.PI + 90; sx = 1; sy = p.size * (1 - u * 0.5); o = 1 - u;
        break;
      }
      case 'rays': {
        x = p.x0; y = p.y0; r = a * 40;
        const pop = Math.min(1, a / 0.25);
        sx = sy = p.size * (pop < 1 ? pop * (1.15 - 0.15 * pop) : 1);
        o = 0.35 * (u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1);
        break;
      }
    }
    return { x, y, r, sx, sy, o };
  }

  class FX {
    constructor(stage) {
      this.back = document.createElementNS(NS, 'g');
      this.front = document.createElementNS(NS, 'g');
      this.back.setAttribute('class', 'fx-back');
      this.front.setAttribute('class', 'fx-front');
      stage.insertBefore(this.back, stage.firstChild);
      stage.appendChild(this.front);
      this.fixed = []; // particles from the current motion's events
      this.live = []; // particles spawned at runtime (playground)
      this.motion = null;
    }
    make(p) {
      const g = document.createElementNS(NS, 'g');
      g.innerHTML = SHAPE[p.type](p);
      g.style.display = 'none';
      (p.type === 'rays' ? this.back : this.front).appendChild(g);
      p.el = g;
      return p;
    }
    // motion-driven events: rebuilt when the motion changes
    setEvents(m) {
      if (this.motion === m) return;
      this.motion = m;
      for (const p of this.fixed) p.el.remove();
      this.fixed = (m && m.fx ? m.fx : []).flatMap(expand).map((p) => this.make(p));
    }
    spawn(ev) {
      for (const p of expand(ev)) this.live.push(this.make(p));
    }
    draw(p, t) {
      const a = t - p.t0;
      if (a < 0 || a > p.life) {
        p.el.style.display = 'none';
        return false;
      }
      const s = state(p, a);
      p.el.style.display = '';
      p.el.setAttribute('transform', `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${s.r.toFixed(1)}) scale(${s.sx.toFixed(3)} ${s.sy.toFixed(3)})`);
      p.el.setAttribute('opacity', Math.max(0, s.o).toFixed(3));
      return true;
    }
    update(tMotion, tLive) {
      for (const p of this.fixed) this.draw(p, tMotion);
      if (tLive !== undefined) {
        this.live = this.live.filter((p) => {
          const alive = this.draw(p, tLive) || tLive < p.t0;
          if (!alive) p.el.remove();
          return alive;
        });
      }
    }
  }
  IPM.FX = FX;
})();
