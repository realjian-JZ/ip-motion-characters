/* IPM engine: SVG parts + keyframe tracks + springs.
 * Deterministic: the same (character, motion, t) always produces the same frame,
 * so preview, render and QA all see identical output. */
(function (g) {
  const IPM = (g.IPM = g.IPM || {});
  IPM.characters = IPM.characters || {};
  IPM.motions = IPM.motions || {};
  IPM.cues = IPM.cues || {};

  // ---------- easing ----------
  const EASE = {
    linear: [0, 0, 1, 1],
    ease: [0.4, 0, 0.2, 1],
    out: [0.1, 0.6, 0.3, 1],
    in: [0.55, 0, 0.9, 0.45],
    inout: [0.65, 0, 0.35, 1],
    snap: [0.2, 0, 0, 1],
    overshoot: [0.34, 1.56, 0.64, 1],
    bouncy: [0.28, 2.1, 0.5, 1],
    back: [0.36, 0, 0.66, -0.56],
    sly: [0.8, 0, 0.2, 1],
    bridge: [0.37, 0, 0.63, 1], // sine in-out: seams between chained motions (inout was too steep mid-way)
  };

  function cubic(p1x, p1y, p2x, p2y) {
    const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
    const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t;
    const Y = (t) => ((ay * t + by) * t + cy) * t;
    const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const err = X(t) - x;
        if (Math.abs(err) < 1e-6) return Y(t);
        const d = dX(t);
        if (Math.abs(d) < 1e-6) break;
        t -= err / d;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 40; i++) {
        if (X(t) < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return Y(t);
    };
  }

  const EASE_FN = {};
  for (const k in EASE) EASE_FN[k] = cubic(...EASE[k]);
  EASE_FN.hold = () => 0;
  IPM.EASE = EASE;

  // ---------- profile → motion parameters (see references/motion-profiles.md) ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  // antic: anticipation length multiplier — the silhouette test showed same-beat timing reads as "same character"
  const STYLE = {
    bouncy: { main: 'snap', settle: 'bouncy', antic: 0.8 },
    steady: { main: 'ease', settle: 'out', antic: 1.0 },
    sly: { main: 'sly', settle: 'overshoot', antic: 1.7 },
    tired: { main: 'inout', settle: 'out', antic: 1.45 },
    slow: { main: 'inout', settle: 'out', antic: 1.5 },
    waddle: { main: 'ease', settle: 'bouncy', antic: 1.1 },
  };

  function derive(p) {
    const w = p.weight ?? 0.5, e = p.energy ?? 0.5, s = p.stability ?? 1;
    const style = STYLE[p.style] || STYLE.bouncy;
    return {
      weight: w, energy: e, stability: s, style: p.style || 'bouncy',
      burst: p.burst ?? e,
      tempo: lerp(1.3, 0.8, e) * lerp(0.92, 1.2, w),
      amp: lerp(0.55, 1.2, e),
      jumpH: lerp(40, 150, e) * lerp(1.1, 0.55, w),
      squash: lerp(0.07, 0.18, w) + 0.04 * e,
      stretch: lerp(0.04, 0.12, e),
      lag: Math.round(lerp(2, 4, w)) / 30,
      tremble: (1 - s) * 2.2,
      armMax: p.armMax ?? 132, // raised-arm limit; above this the arm covers the face (CHANGELOG v0.1.1)
      tiptoe: lerp(40, 150, e) * lerp(1.1, 0.55, w) < 60, // too little spring to leave the ground: rise on tiptoe instead
      main: style.main,
      settle: style.settle,
      antic: style.antic,
    };
  }
  IPM.derive = derive;

  // ---------- tracks ----------
  function evalKeys(keys, t) {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 2 && t >= keys[i + 1][0]) i++;
    const [t0, v0, e] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (t1 <= t0) return v1;
    const f = EASE_FN[e || 'ease'] || EASE_FN.ease;
    return v0 + (v1 - v0) * f((t - t0) / (t1 - t0));
  }

  IPM.evalKeys = evalKeys;

  function evalSwap(keys, t) {
    let v = keys[0][1];
    for (const [kt, kv] of keys) if (t >= kt) v = kv;
    return v;
  }

  const DEFAULTS = { x: 0, y: 0, r: 0, sx: 1, sy: 1, ss: 1, o: 1 };
  IPM.DEFAULTS = DEFAULTS;

  function normalize(m) {
    m.tracks = m.tracks || {};
    m.swaps = m.swaps || {};
    for (const part in m.tracks)
      for (const prop in m.tracks[part]) m.tracks[part][prop].sort((a, b) => a[0] - b[0]);
    for (const grp in m.swaps) m.swaps[grp].sort((a, b) => a[0] - b[0]);
    return m;
  }

  function localTime(m, t) {
    if (m.loop) return ((t % m.duration) + m.duration) % m.duration;
    return Math.min(Math.max(t, 0), m.duration);
  }

  // ---------- rig ----------
  class Rig {
    constructor(svg, def) {
      this.svg = svg;
      this.def = def;
      this.D = derive(def.profile || {});
      this.parts = {};
      svg.querySelectorAll('[data-part]').forEach((el) => {
        const [px, py] = (el.getAttribute('data-pivot') || '0 0').trim().split(/[\s,]+/).map(Number);
        this.parts[el.getAttribute('data-part')] = { el, px, py };
      });
      // ancestor chain per part, for upright (hanging) parts
      for (const id in this.parts) {
        const chain = [];
        let p = this.parts[id].el.parentElement && this.parts[id].el.parentElement.closest('[data-part]');
        while (p) {
          chain.push(p.getAttribute('data-part'));
          p = p.parentElement && p.parentElement.closest('[data-part]');
        }
        this.parts[id].ancestors = chain;
      }
      this.groups = {};
      svg.querySelectorAll('[data-swap]').forEach((el) => {
        const grp = el.getAttribute('data-group');
        const list = (this.groups[grp] = this.groups[grp] || { items: {}, def: null });
        const name = el.getAttribute('data-swap');
        list.items[name] = el;
        if (el.hasAttribute('data-default') || !list.def) list.def = name;
      });
      this.cache = {};
      // automatic overlap: forearms trail fast upper-arm swings and overshoot when they stop.
      // Hand-keyed forearm poses stay as authored; this only adds the drag on top. Opt out with def.noDrag.
      this.springs = (def.springs || []).slice();
      if (!def.noDrag) {
        for (const s of ['l', 'r']) {
          if (this.parts['arm_' + s] && this.parts['fore_' + s]) {
            this.springs.push({ part: 'fore_' + s, prop: 'r', src: [{ part: 'arm_' + s, prop: 'r' }], k: 320, c: 15, gain: 0.45, max: 14 });
          }
        }
      }
      // automatic jelly: any upward acceleration of the root (take-off, landing) squashes the body and the head
      // a little extra and lets them wobble back (inertia: the bottom moves first, the top lags). Opt out: def.noJelly.
      if (!def.noJelly) {
        this.springs.push({ part: 'body', prop: 'ss', src: [{ part: 'root', prop: 'y' }], k: 380, c: 7.5, gain: -0.0022, max: 0.06 });
        if (this.parts.head) this.springs.push({ part: 'head', prop: 'ss', src: [{ part: 'root', prop: 'y' }], k: 300, c: 6, gain: -0.0022, max: 0.06 });
      }
    }

    motion(name) {
      if (!this.cache[name]) {
        // "speak@sample" → template "speak" with argument "sample" (e.g. a lipsync cue set)
        // split at the first @ only, so seq@idle@1+shock keeps the inner variant
        const at = name.indexOf('@');
        const base = at < 0 ? name : name.slice(0, at), arg = at < 0 ? undefined : name.slice(at + 1);
        const tpl = IPM.motions[base];
        if (!tpl) throw new Error('unknown motion: ' + name);
        // burst templates (happy/cheer) use the character's burst energy: the tired worker's sudden spark
        const p = this.def.profile || {};
        const D = tpl.burst && p.burst != null ? derive(Object.assign({}, p, { energy: p.burst })) : this.D;
        this.cache[name] = normalize(tpl(D, this.def, arg));
      }
      return this.cache[name];
    }

    raw(m, part, prop, t) {
      const tr = m.tracks[part];
      const keys = tr && tr[prop];
      return keys ? evalKeys(keys, localTime(m, t)) : DEFAULTS[prop];
    }

    spring(m, sp, t) {
      const dt = 1 / 240;
      const src = (tau) => sp.src.reduce((s, q) => s + (q.w ?? 1) * this.raw(m, q.part, q.prop, tau), 0);
      // loops: pre-roll two cycles so the spring is already settled into the cycle
      const start = m.loop ? t - 2 * m.duration : 0;
      const steps = Math.max(0, Math.round((t - start) / dt));
      let th = 0, w = 0, s0 = src(start - dt), s1 = src(start);
      for (let i = 0; i < steps; i++) {
        const s2 = src(start + (i + 1) * dt);
        const a = (s2 - 2 * s1 + s0) / (dt * dt);
        w += (-sp.k * th - sp.c * w - sp.gain * a) * dt;
        th += w * dt;
        s0 = s1;
        s1 = s2;
      }
      const max = sp.max ?? 30;
      return max * Math.tanh(th / max);
    }

    sample(m, t) {
      const lt = localTime(m, t);
      const state = {};
      for (const id in this.parts) {
        const st = (state[id] = Object.assign({}, DEFAULTS));
        const tr = m.tracks[id];
        if (tr) for (const prop in tr) st[prop] = evalKeys(tr[prop], lt);
      }
      // upright parts (bags, pendants) cancel their ancestors' rotation so they keep hanging down;
      // springs below then add the swing on top
      for (const id of this.def.upright || []) {
        if (state[id]) state[id].r -= this.parts[id].ancestors.reduce((s, a) => s + state[a].r, 0);
      }
      for (const sp of this.springs) {
        // one-shots: keep simulating past the end (sources hold their last value) so props settle
        // instead of freezing mid-swing on the final frame
        if (state[sp.part]) state[sp.part][sp.prop] += this.spring(m, sp, m.loop ? t : Math.max(0, t));
      }
      // tremble for unsteady profiles: two incommensurate sines so it never reads as a loop
      if (this.D.tremble > 0.3) {
        const a = this.D.tremble, n1 = Math.sin(t * 33.3) * 0.6 + Math.sin(t * 49.7 + 1) * 0.4;
        const n2 = Math.sin(t * 41.1 + 2) * 0.6 + Math.sin(t * 57.3) * 0.4;
        if (state.head) state.head.r += a * n1;
        if (state.fore_l) state.fore_l.r += a * 1.5 * n2;
        if (state.fore_r) state.fore_r.r -= a * 1.5 * n1;
      }
      if (state.shadow && state.root) {
        const k = Math.min(1, Math.max(0.45, 1 + state.root.y / 320));
        const ss = state.body ? state.body.ss : 1;
        state.shadow.sx *= k / Math.sqrt(ss);
        state.shadow.sy *= k;
        state.shadow.o *= 0.4 + 0.6 * k;
        state.shadow.x += state.root.x;
      }
      // swapAlias lets a character keep shared template names but show its own shape (scammer: smile → smirk)
      const alias = this.def.swapAlias || {};
      const swaps = {};
      for (const grp in this.groups) {
        const keys = m.swaps[grp];
        const name = keys ? evalSwap(keys, lt) : this.groups[grp].def;
        swaps[grp] = alias[name] && this.groups[grp].items[alias[name]] ? alias[name] : name;
      }
      return { state, swaps };
    }

    apply({ state, swaps }) {
      for (const id in this.parts) {
        const { el, px, py } = this.parts[id];
        const s = state[id];
        const sx = s.sx / s.ss, sy = s.sy * s.ss;
        el.setAttribute(
          'transform',
          `translate(${(s.x + px).toFixed(2)} ${(s.y + py).toFixed(2)}) rotate(${s.r.toFixed(3)}) ` +
            `scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-px} ${-py})`
        );
        if (s.o !== 1) el.setAttribute('opacity', s.o.toFixed(3));
        else el.removeAttribute('opacity');
      }
      for (const grp in this.groups) {
        const g2 = this.groups[grp];
        const active = g2.items[swaps[grp]] ? swaps[grp] : g2.def;
        for (const name in g2.items) g2.items[name].style.display = name === active ? '' : 'none';
      }
    }

    pose(name, t) {
      const m = this.motion(name);
      this.apply(this.sample(m, t));
      return m;
    }

    showPivots(on) {
      this.svg.querySelectorAll('.ipm-pivot').forEach((n) => n.remove());
      if (!on) return;
      const NS = 'http://www.w3.org/2000/svg';
      for (const id in this.parts) {
        const { el, px, py } = this.parts[id];
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('class', 'ipm-pivot');
        c.setAttribute('cx', px);
        c.setAttribute('cy', py);
        c.setAttribute('r', 4);
        c.setAttribute('fill', '#ff2d6f');
        c.setAttribute('stroke', '#fff');
        c.setAttribute('stroke-width', 1.5);
        el.appendChild(c);
      }
    }
  }

  IPM.register = (id, def) => {
    IPM.characters[id] = Object.assign({ id }, def);
  };

  IPM.mount = async (container, id) => {
    const def = IPM.characters[id];
    if (!def) throw new Error('unknown character: ' + id);
    const txt = await (await fetch(def.svg)).text();
    container.innerHTML = txt;
    const svg = container.querySelector('svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    injectProps(svg, def);
    return new Rig(svg, def);
  };

  // Shared props, drawn once and injected into every character's free hand as a hidden swap group
  // ("prop_phone": off / on). Motions show them like a mouth shape. The hand is drawn after the prop,
  // so the fingers grip it.
  const NS = 'http://www.w3.org/2000/svg';
  const PROPS = {
    // gripped at the hand (x = ±84), extending AWAY from the elbow: hanging it points down, and when the
    // forearm folds up it stands in front of the face. (Extending toward the elbow put it on the shoulder.)
    phone: (x) =>
      `<rect x="${x - 14}" y="-92" width="28" height="50" rx="6" fill="#2B2233"/>` +
      `<rect x="${x - 11}" y="-82" width="22" height="36" rx="3" fill="#7FD3F7"/>` +
      `<rect x="${x - 8}" y="-56" width="16" height="4" rx="2" fill="#FFFFFF" opacity="0.8"/>` +
      `<rect x="${x - 8}" y="-64" width="11" height="4" rx="2" fill="#FFFFFF" opacity="0.6"/>`,
  };
  IPM.freeSide = (def) => (def.busyHand === 'r' ? 'l' : 'r');
  function injectProps(svg, def) {
    injectStage(svg);
    const side = IPM.freeSide(def);
    const hx = def.handX ?? 84; // hand centre x; animals with longer / shorter arms override it
    const fore = svg.querySelector(`[data-part="fore_${side}"]`);
    if (!fore) return;
    // insert before the hand: the first hand swap group, else the last child
    const hand = fore.querySelector(':scope > [data-group^="hand"]') || fore.lastElementChild;
    for (const [name, draw] of Object.entries(PROPS)) {
      for (const state of ['off', 'on']) {
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('data-group', 'prop_' + name);
        g.setAttribute('data-swap', state);
        if (state === 'off') g.setAttribute('data-default', '');
        else g.innerHTML = draw(side === 'r' ? hx : -hx);
        fore.insertBefore(g, hand);
      }
    }
    injectFX(svg, fore, side === 'r' ? hx : -hx, def);
  }

  // Gesture fingers and effects, also shared by every character.
  //   swap group "gesture" (none / peace): two fingers drawn ON TOP of the free hand, pointing away from the elbow
  //   part "fx_heart" + group (off / on): a heart in front of the chest, animated by tracks (pop, float, fade)
  //   part "fx_stars" + group (off / on): three stars circling above the head (dizzy)
  const star = (cx, cy, r) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
      pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="#FFD84D" stroke="#F2B230" stroke-width="2" stroke-linejoin="round"/>`;
  };
  function swapPair(group, onHTML) {
    const off = document.createElementNS(NS, 'g');
    off.setAttribute('data-group', group);
    off.setAttribute('data-swap', 'off');
    off.setAttribute('data-default', '');
    const on = document.createElementNS(NS, 'g');
    on.setAttribute('data-group', group);
    on.setAttribute('data-swap', 'on');
    on.innerHTML = onHTML;
    return [off, on];
  }
  function fxPart(id, pivot, onHTML) {
    const p = document.createElementNS(NS, 'g');
    p.setAttribute('data-part', id);
    p.setAttribute('data-pivot', pivot);
    for (const g of swapPair(id, onHTML)) p.appendChild(g);
    return p;
  }
  function injectFX(svg, fore, x, def) {
    // V sign: fingers from the knuckles outward, splayed ±14°
    // thick fingers with a dark outline: they often sit near the face, and skin on skin disappears
    const finger = (deg) =>
      `<rect x="${x - 6.5}" y="-88" width="13" height="38" rx="6.5" fill="#FFD3B0" stroke="#D9895F" stroke-width="2.5" transform="rotate(${deg} ${x} -86)"/>`;
    // flippers and hooves have no fingers (def.noFingers): the gesture group stays empty, the pose still plays
    const [none, peace] = swapPair('gesture', def.noFingers ? '' : finger(20) + finger(-20));
    none.setAttribute('data-swap', 'none');
    peace.setAttribute('data-swap', 'peace');
    fore.appendChild(none);
    fore.appendChild(peace);
    const torso = svg.querySelector('[data-part="torso"]');
    if (torso) {
      torso.appendChild(fxPart('fx_heart', '0 -172',
        '<path d="M 0 -150 C -34 -170 -30 -198 -11 -198 C -3 -198 0 -192 0 -188 C 0 -192 3 -198 11 -198 C 30 -198 34 -170 0 -150 Z" fill="#FF5C8A"/>' +
        '<path d="M -18 -186 Q -16 -192 -10 -192" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.8"/>'));
    }
    // dizzy stars: the ring (fx_stars) spins; each star is its own part so it can be knocked loose on impact
    const head = svg.querySelector('[data-part="head"]');
    // offsets from the ring centre; the ring sits at def.starsY (default −400, just above a standard head)
    const STARS = [[48, 0, 13], [-24, 42, 11], [-24, -42, 11]];
    IPM.STARS = STARS;
    const sy = def.starsY ?? -400;
    if (head) {
      head.appendChild(fxPart('fx_stars', `0 ${sy}`,
        STARS.map(([cx, cy, r], i) => `<g data-part="fx_star${i}" data-pivot="${cx} ${cy + sy}">${star(cx, cy + sy, r)}</g>`).join('')));
    }
  }

  // stage: wraps shadow + character so a heavy impact can shake the whole picture; dust puffs live on the ground
  // in front of the feet (fx_dust moves to where the impact happens; the two puffs fly apart).
  function injectStage(svg) {
    const root = svg.querySelector('[data-part="root"]');
    if (!root || svg.querySelector('[data-part="stage"]')) return;
    const holder = root.parentNode;
    const stage = document.createElementNS(NS, 'g');
    stage.setAttribute('data-part', 'stage');
    stage.setAttribute('data-pivot', '0 0');
    for (const el of Array.from(holder.childNodes)) stage.appendChild(el);
    holder.appendChild(stage);
    const puff = (cx) =>
      `<circle cx="${cx}" cy="-8" r="14" fill="#E9DFCF"/><circle cx="${cx + 13 * Math.sign(cx)}" cy="-4" r="10" fill="#E9DFCF"/>` +
      `<circle cx="${cx - 9 * Math.sign(cx)}" cy="-14" r="8" fill="#F6F1E7"/>`;
    stage.appendChild(fxPart('fx_dust', '0 0',
      `<g data-part="fx_puff_l" data-pivot="-62 -8">${puff(-62)}</g><g data-part="fx_puff_r" data-pivot="62 -8">${puff(62)}</g>`));
  }

  IPM.Rig = Rig;
})(window);
