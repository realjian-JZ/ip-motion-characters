/* Parameterised motion templates: (D = IPM.derive(profile), def) → { duration, loop, tracks, swaps }.
 * Keys are [time, value, easeToNext]. Times are authored at tempo 1 and scaled with T().
 * Arms: arm_l positive = raise outward, arm_r negative = raise outward (mirror()). */
(function () {
  const M = IPM.motions;
  const mirror = (keys) => keys.map(([t, v, e]) => [t, -v, e]);
  // mirror a whole motion left↔right: swap _l/_r parts and negate rotation / x
  const flip = (m) => {
    const tracks = {};
    for (const part in m.tracks) {
      const name = part.replace(/_(l|r)$/, (_, s) => (s === 'l' ? '_r' : '_l'));
      tracks[name] = {};
      for (const prop in m.tracks[part]) {
        const keys = m.tracks[part][prop];
        tracks[name][prop] = prop === 'r' || prop === 'x' ? mirror(keys) : keys;
      }
    }
    return Object.assign({}, m, { tracks });
  };
  IPM.flip = flip;
  // a one-hand gesture authored on `hand` moves to the other hand when the character is holding something there
  const freeHand = (m, hand, def) => (def && def.busyHand === hand ? flip(m) : m);

  // ---------- impact helpers ----------
  const addKeys = (m, part, prop, keys) => {
    m.tracks[part] = m.tracks[part] || {};
    (m.tracks[part][prop] = m.tracks[part][prop] || []).push(...keys);
  };
  const addSwap = (m, grp, keys) => {
    m.swaps = m.swaps || {};
    (m.swaps[grp] = m.swaps[grp] || [[0, 'off']]).push(...keys);
  };
  // dust puffs on the ground at each impact: [{ t, x = 0, s = 1 }]; puffs fly apart, grow, fade (0.45s)
  function addDust(m, events) {
    for (const { t, x = 0, s = 1 } of events) {
      addKeys(m, 'fx_dust', 'x', [[t, x, 'hold'], [t + 0.5, x, 'hold']]);
      for (const [p, dir] of [['fx_puff_l', -1], ['fx_puff_r', 1]]) {
        addKeys(m, p, 'x', [[t, 0, 'out'], [t + 0.45, 34 * dir * s]]);
        addKeys(m, p, 'y', [[t, 0, 'out'], [t + 0.45, -10 * s]]);
        addKeys(m, p, 'sx', [[t, 0.3, 'out'], [t + 0.45, 1.25 * s]]);
        addKeys(m, p, 'sy', [[t, 0.3, 'out'], [t + 0.45, 1.1 * s]]);
        addKeys(m, p, 'o', [[t, 1, 'in'], [t + 0.45, 0]]);
      }
      addSwap(m, 'fx_dust', [[t, 'on'], [t + 0.45, 'off']]);
    }
    return m;
  }
  // picture shake for the heaviest impacts: a few decaying jolts of the whole stage
  function addShake(m, t, amp) {
    addKeys(m, 'stage', 'y', [[t, 0, 'snap'], [t + 0.03, amp, 'inout'], [t + 0.07, -amp * 0.6, 'inout'], [t + 0.11, amp * 0.3, 'inout'], [t + 0.16, 0]]);
    addKeys(m, 'stage', 'x', [[t, 0, 'snap'], [t + 0.04, -amp * 0.5, 'inout'], [t + 0.09, amp * 0.3, 'inout'], [t + 0.15, 0]]);
    return m;
  }
  IPM.fx = { addDust, addShake };

  // deterministic PRNG for seeded variants (same seed → same frames)
  const rand = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---------- idle[@seed]: loop, breath 2.4s × 2, blinks, one glance (eyes lead, head anticipates) ----------
  // idle@1, idle@2 … shift blink timing and glance side/time so back-to-back loops don't repeat exactly.
  M.idle = (D, def, arg) => {
    const b = 0.008 + 0.01 * D.amp, turn = 2.5 * D.amp;
    let g = 2.42, dir = 1, blinks = [1.3, 3.9, 4.25];
    if (arg) {
      const n = parseInt(arg, 10) || 1, r = rand(n);
      g = 2.0 + r() * 0.9;
      dir = n % 2 ? -1 : 1; // alternate sides so consecutive variants never glance the same way
      const b2 = 3.7 + r() * 0.3;
      blinks = [0.7 + r() * 1.0, b2].concat(r() < 0.5 ? [b2 + 0.35] : []);
    }
    const blink = (t0) => [[t0, 1, 'in'], [t0 + 0.067, 0.1, 'hold'], [t0 + 0.1, 0.1, 'out'], [t0 + 0.2, 1]];
    const armL = [[0, 3, 'inout'], [1.2, 5, 'inout'], [2.4, 3, 'inout'], [3.6, 5, 'inout'], [4.8, 3]];
    const foreL = [[0, -4, 'inout'], [1.35, -8, 'inout'], [2.55, -4, 'inout'], [3.75, -8, 'inout'], [4.8, -4]];
    const glanceBrow = [[0, 0], [g, 0, 'snap'], [g + 0.14, -4], [g + 0.78, -1, 'inout'], [4.8, 0]];
    const m = {
      duration: 4.8,
      loop: true,
      meta: { g, dir },
      tracks: {
        body: { ss: [[0, 1, 'inout'], [1.2, 1 + b, 'inout'], [2.4, 1, 'inout'], [3.6, 1 + b, 'inout'], [4.8, 1]] },
        head: {
          y: [[0, 0, 'inout'], [1.3, -2, 'inout'], [2.5, 0, 'inout'], [3.7, -2, 'inout'], [4.8, 0]],
          // small counter-turn before the turn (anticipation), eyes already moved 3 frames earlier
          r: [[0, 0], [g + 0.08, 0, 'snap'], [g + 0.2, -0.35 * turn * dir, 'inout'], [g + 0.5, turn * dir, 'inout'],
            [g + 1.13, turn * dir, 'inout'], [g + 1.58, 0], [4.8, 0]],
        },
        arm_l: { r: armL },
        arm_r: { r: mirror(armL) },
        fore_l: { r: foreL },
        fore_r: { r: mirror(foreL) },
        eyes: { sy: [[0, 1], ...blinks.flatMap(blink), [4.8, 1]] },
        pupils: {
          x: [[0, 0], [g, 0, 'snap'], [g + 0.14, 7 * dir], [g + 1.03, 7 * dir, 'snap'], [g + 1.18, 0], [4.8, 0]],
          y: [[0, 0], [g, 0, 'snap'], [g + 0.14, -2], [g + 1.03, -2, 'snap'], [g + 1.18, 0], [4.8, 0]],
        },
        brow_l: { y: glanceBrow },
        brow_r: { y: glanceBrow },
      },
      swaps: { mouth: [[0, 'smile']] },
    };
    return idleStyle(m, D);
  };

  // personality layer on top of the shared idle (silhouette test: shared idle read identical across characters)
  function idleStyle(m, D) {
    const t = m.tracks;
    if (D.style === 'bouncy') {
      // two little toe-bounces, can't stand still
      t.root = { y: [[0, 0], [0.6, 0, 'out'], [0.75, -5, 'in'], [0.9, 0, 'out'], [1.05, -5, 'in'], [1.2, 0], [4.8, 0]] };
      t.head.y = [[0, 0], [0.65, 0, 'out'], [0.8, -3, 'in'], [0.95, 1, 'out'], [1.1, -3, 'in'], [1.3, 0, 'inout'], [3.7, -2, 'inout'], [4.8, 0]];
    } else if (D.style === 'sly') {
      // shifty: extra glance to the other side, weight follows the eyes, one brow up
      const { g, dir } = m.meta;
      t.pupils.x = [[0, 0], [0.8, 0, 'snap'], [0.92, -7 * dir], [1.6, -7 * dir, 'snap'], [1.72, 0], [g, 0, 'snap'], [g + 0.14, 7 * dir], [g + 1.03, 7 * dir, 'snap'], [g + 1.18, 0], [4.8, 0]];
      t.root = { x: [[0, 0], [0.85, 0, 'sly'], [1.25, -5 * dir, 'inout'], [1.65, -5 * dir, 'sly'], [2.0, 0], [g + 0.08, 0, 'sly'], [g + 0.48, 5 * dir, 'inout'], [g + 1.08, 5 * dir, 'sly'], [g + 1.48, 0], [4.8, 0]] };
      t.brow_l = { y: [[0, 0], [0.9, 0, 'snap'], [1.05, -7, 'out'], [1.6, -7, 'inout'], [1.9, 0], [4.8, 0]] };
    } else if (D.style === 'tired') {
      // nodding off: eyes sink, head drops, then jerks back awake
      t.head.y = [[0, 0, 'inout'], [1.6, 0, 'in'], [2.5, 11, 'snap'], [2.62, -4, 'out'], [3.0, 0, 'inout'], [4.8, 0]];
      t.head.r = [[0, 0, 'inout'], [1.6, 0, 'in'], [2.5, 4], [2.62, -1, 'out'], [3.0, 0], [4.8, 0]];
      t.eyes.sy = [[0, 1], [1.3, 1, 'in'], [1.367, 0.1, 'hold'], [1.4, 0.1, 'out'], [1.5, 1, 'inout'], [1.6, 1, 'inout'], [2.5, 0.25, 'snap'],
        [2.62, 1.15, 'out'], [2.9, 1], [3.9, 1, 'in'], [3.967, 0.1, 'hold'], [4.0, 0.1, 'out'], [4.1, 1], [4.8, 1]];
      t.brow_l = { y: [[0, 0], [2.5, 2, 'snap'], [2.62, -8, 'out'], [3.1, 0], [4.8, 0]] };
      t.brow_r = { y: [[0, 0], [2.5, 2, 'snap'], [2.62, -8, 'out'], [3.1, 0], [4.8, 0]] };
    } else if (D.style === 'slow') {
      // deeper, slower breathing
      t.body.ss = [[0, 1, 'inout'], [2.4, 1.03, 'inout'], [4.8, 1]];
    } else if (D.style === 'waddle') {
      // can't stand still: rocks from foot to foot, one happy flipper flap
      t.torso = { r: [[0, 0, 'inout'], [0.6, 3, 'inout'], [1.8, -3, 'inout'], [3.0, 3, 'inout'], [4.2, -3, 'inout'], [4.8, 0]] };
      t.root = { x: [[0, 0, 'inout'], [0.6, -2, 'inout'], [1.8, 2, 'inout'], [3.0, -2, 'inout'], [4.2, 2, 'inout'], [4.8, 0]] };
      const flapL = [[0, 3], [3.2, 3, 'snap'], [3.32, 24, 'inout'], [3.44, 6, 'inout'], [3.56, 24, 'inout'], [3.72, 3], [4.8, 3]];
      t.arm_l = { r: flapL };
      t.arm_r = { r: mirror(flapL) };
    }
    return m;
  }

  // ---------- happy_jump: anticipation → take-off → rise(out) → fall(in) → squash → settle ----------
  M.happy_jump = (D) => {
    // tiptoe profiles (elder) rise onto their toes instead of leaving the ground
    const T = (x) => x * D.tempo, L = D.lag, H = D.tiptoe ? 14 : D.jumpH, A = Math.min(D.amp, 1.1);
    // style-scaled anticipation shifts every later beat; bouncy characters add a small rebound hop
    const d = T(0.18) * (D.antic - 1), rb = D.style === 'bouncy';
    const a1 = T(0.18) + d, to = T(0.24) + d, ap = T(0.52) + d, ld = T(0.8) + d, sq = T(0.85) + d, end = T(1.16) + d + (rb ? T(0.22) : 0);
    const r1 = sq + T(0.06), r2 = sq + T(0.15), r3 = sq + T(0.26);
    // arms up stay a "V" (≤ D.armMax) — straight overhead covers the face on big-head characters
    const up = Math.min(D.armMax, (D.tiptoe ? 90 : 118) * A);
    const armL = [[0, 0, D.main], [a1, -12, 'snap'], [to + L, up, 'out'], [ap + T(0.08), up - 8, 'in'], [ld + L, 30, D.settle], [end + 2 * L, 0]];
    const foreL = [[0, 0], [a1 + L, 12, 'snap'], [to + 2 * L, 30, 'out'], [ap + T(0.1), 12, 'in'], [ld + 2 * L, -25, D.settle], [end + 3 * L, 0]];
    const legL = [[0, 0], [to, 0, 'out'], [ap, D.tiptoe ? 0 : 9, 'in'], [ld, 0]];
    const brow = [[0, 0], [a1, 4, 'snap'], [to, -12, D.settle], [ld + L, -6, 'inout'], [end + 0.3, 0]];
    return {
      duration: end + 0.45,
      loop: false,
      tracks: {
        root: { y: rb ? [[0, 0], [to, 0, 'out'], [ap, -H, 'in'], [ld, 0], [r1, 0, 'out'], [r2, -H * 0.16, 'in'], [r3, 0]]
          : [[0, 0], [to, 0, 'out'], [ap, -H, 'in'], [ld, 0]] },
        body: {
          ss: rb ? [[0, 1, D.main], [a1, 1 - 0.8 * D.squash, 'out'], [to, 1 + D.stretch, 'out'], [ap, 1, 'in'],
            [ld, 1 + 0.7 * D.stretch, 'snap'], [sq, 1 - D.squash, 'out'], [r1, 1 + 0.5 * D.stretch, 'out'], [r2, 1, 'in'],
            [r3, 1 - 0.5 * D.squash, D.settle], [end, 1]]
            : [[0, 1, D.main], [a1, 1 - 0.8 * D.squash, 'out'], [to, 1 + D.stretch, 'out'], [ap, 1, 'in'],
            // hit-hold: the deepest squash is held 2 frames before the rebound — that pause is what reads as impact
            [ld, 1 + 0.7 * D.stretch, 'snap'], [sq, 1 - D.squash, 'hold'], [sq + 0.066, 1 - D.squash * 0.97, D.settle], [end, 1]],
        },
        torso: { r: [[0, 0], [ld, 0, 'snap'], [ld + T(0.06), -2.5 * A, 'inout'], [end + L, 0]] },
        head: {
          y: [[0, 0, D.main], [a1 + L, 7, 'out'], [to + L, -6, 'out'], [ap + L, 0, 'in'], [ld + L, 9, D.settle], [end + L, 0]],
          r: [[0, 0], [to, 0, 'out'], [ap, 4 * A, 'inout'], [ld + L, -3 * A, D.settle], [end + L, 0]],
        },
        arm_l: { r: armL },
        arm_r: { r: mirror(armL) },
        fore_l: { r: foreL },
        fore_r: { r: mirror(foreL) },
        leg_l: { r: legL },
        leg_r: { r: mirror(legL) },
        eyes: { sy: [[0, 1], [a1, 0.8, 'snap'], [to, 1.08, 'out'], [ap, 1, 'in'], [ld, 1, 'snap'], [sq, 0.55, 'out'], [end + L, 1]] },
        pupils: { y: [[0, 0], [a1, 2], [to, -4], [ld, 0]] },
        brow_l: { y: brow },
        brow_r: { y: brow },
      },
      swaps: { mouth: [[0, 'smile'], [a1, 'flat'], [to, 'grin'], [end + 0.1, 'smile']] },
    };
  };

  // ---------- cheer: arms snap up, two hops with fist pumps, arms drop with overshoot ----------
  M.cheer = (D) => {
    const T = (x) => x * D.tempo, L = D.lag, h = D.tiptoe ? 8 : D.jumpH * 0.32, A = Math.min(D.amp, 1.1);
    const tuck = D.tiptoe ? 0 : 6;
    const up = T(0.16), down = T(1.0), rest = T(1.25);
    const top = Math.min(D.armMax, 122 * A);
    const armL = [[0, 0, 'snap'], [up, top, D.settle], [down, top - 5, D.main], [rest, 0, D.settle]];
    const foreL = [[0, 0], [up, 25, 'inout'], [T(0.3), -15, 'inout'], [T(0.42), 25, 'inout'], [T(0.6), -15, 'inout'],
      [T(0.72), 25, 'inout'], [T(0.9), 0, 'out'], [down, 0, 'snap'], [rest + L, -15, D.settle], [rest + 3 * L, 0]];
    const legL = [[0, 0], [T(0.18), 0, 'out'], [T(0.3), tuck, 'in'], [T(0.42), 0], [T(0.48), 0, 'out'], [T(0.6), tuck, 'in'], [T(0.72), 0]];
    const brow = [[0, 0], [T(0.1), -12, D.settle], [down, -10], [T(1.2), 0]];
    return {
      duration: rest + 3 * L + 0.25,
      loop: false,
      tracks: {
        root: { y: [[0, 0], [T(0.18), 0, 'out'], [T(0.3), -h, 'in'], [T(0.42), 0], [T(0.48), 0, 'out'], [T(0.6), -h * 0.85, 'in'], [T(0.72), 0]] },
        body: {
          ss: [[0, 1, 'snap'], [T(0.1), 1 - 0.6 * D.squash, 'out'], [T(0.18), 1 + 0.8 * D.stretch, 'out'], [T(0.3), 1, 'in'],
            [T(0.42), 1 - 0.6 * D.squash, 'out'], [T(0.48), 1 + 0.7 * D.stretch, 'out'], [T(0.6), 1, 'in'],
            [T(0.72), 1 - 0.7 * D.squash, D.settle], [T(0.95), 1]],
        },
        head: {
          y: [[0, 0], [T(0.1) + L, 5], [T(0.3) + L, -6, 'in'], [T(0.42) + L, 6, 'out'], [T(0.6) + L, -5, 'in'], [T(0.72) + L, 6, D.settle], [T(0.95) + L, 0]],
          r: [[0, 0, 'inout'], [up, -4 * A, 'inout'], [T(0.6), 4 * A, 'inout'], [down, 0]],
        },
        arm_l: { r: armL },
        arm_r: { r: mirror(armL) },
        fore_l: { r: foreL },
        fore_r: { r: mirror(foreL) },
        leg_l: { r: legL },
        leg_r: { r: mirror(legL) },
        eyes: { sy: [[0, 1], [T(0.1), 0.5, 'snap'], [down, 0.5, 'out'], [T(1.15), 1]] },
        brow_l: { y: brow },
        brow_r: { y: brow },
      },
      swaps: { mouth: [[0, 'smile'], [T(0.08), 'grin'], [T(1.15), 'smile']] },
    };
  };

  // ---------- sad: inhale → slump (heavy) → sigh hold → recover ----------
  M.sad = (D) => {
    const T = (x) => x * D.tempo * 1.25, L = D.lag * 1.5;
    const inh = T(0.35), slump = T(0.95), hold = T(1.9), back = T(2.45);
    const armL = [[0, 0], [inh, 3, 'out'], [slump, -6, 'inout'], [hold, -6, 'inout'], [back, 0]];
    const browR = [[0, 0], [inh, -12, 'inout'], [hold, -16, 'inout'], [back, 0]];
    return {
      duration: back + 0.25,
      loop: false,
      tracks: {
        body: { ss: [[0, 1, 'inout'], [inh, 1.025, 'out'], [slump, 0.95, 'inout'], [hold, 0.955, 'inout'], [back, 1]] },
        head: {
          y: [[0, 0, 'inout'], [inh, -3, 'out'], [slump + L, 12, 'inout'], [hold, 11, 'inout'], [back + L, 0]],
          r: [[0, 0, 'inout'], [slump + L, -5, 'inout'], [T(1.35), -3, 'inout'], [hold, -5, 'inout'], [back + L, 0]],
        },
        arm_l: { r: armL },
        arm_r: { r: mirror(armL) },
        fore_l: { r: [[0, 0], [slump + L, 4, 'inout'], [hold, 4, 'inout'], [back + L, 0]] },
        fore_r: { r: [[0, 0], [slump + L, -4, 'inout'], [hold, -4, 'inout'], [back + L, 0]] },
        eyes: { sy: [[0, 1], [inh, 1, 'inout'], [slump, 0.8, 'inout'], [hold, 0.8, 'inout'], [back, 1]] },
        pupils: {
          x: [[0, 0], [inh, 0, 'snap'], [inh + 0.12, -4], [hold, -4, 'inout'], [back, 0]],
          y: [[0, 0], [inh, 0, 'snap'], [inh + 0.12, 5], [hold, 5, 'inout'], [back, 0]],
        },
        // inner brow ends lift: brow_l negative, brow_r positive
        brow_l: { r: mirror(browR), y: [[0, 0], [inh, -3], [hold, -2], [back, 0]] },
        brow_r: { r: browR, y: [[0, 0], [inh, -3], [hold, -2], [back, 0]] },
      },
      swaps: { mouth: [[0, 'smile'], [T(0.12), 'o'], [inh + 0.1, 'sad'], [hold + 0.1, 'flat'], [back - 0.05, 'smile']] },
    };
  };

  // ---------- think: hand to chin, eyes up-left, finger tap, "idea" pop on exit ----------
  M.think = (D, def) => {
    const T = (x) => x * D.tempo, L = D.lag, A = Math.min(D.amp, 1.1);
    const reach = T(0.42), exit = T(1.9), back = T(2.45);
    // chin out of reach (giraffe: head on a neck) → hoof on the chest instead (upper arm 20°, forearm 95°)
    const UA = def && def.chinReach === false ? 20 : 26, FA = def && def.chinReach === false ? 95 : 140;
    // gesture with the free hand: a character holding something in the right hand mirrors the pose
    const m = {
      duration: back + 0.25,
      loop: false,
      tracks: {
        body: { ss: [[0, 1], [exit, 1, 'snap'], [exit + T(0.1), 1.04, D.settle], [exit + T(0.4), 1]] },
        torso: { r: [[0, 0, 'inout'], [T(0.5), 2, 'inout'], [exit, 2, 'snap'], [T(2.2), 0]] },
        arm_r: { r: [[0, 0, 'snap'], [T(0.08), -6, 'snap'], [reach, UA, D.settle], [exit, UA, 'snap'], [T(2.15), -4, D.settle], [back, 0]] },
        fore_r: {
          r: [[0, 0, 'snap'], [T(0.12) + L, 0, 'snap'], [T(0.5) + L, FA, D.settle], [T(1.0), FA, 'inout'], [T(1.12), FA - 8, 'inout'],
            [T(1.24), FA, 'inout'], [T(1.36), FA - 8, 'inout'], [T(1.48), FA], [exit, FA, 'snap'], [T(2.2), 0, D.settle], [back, 0]],
        },
        arm_l: { r: [[0, 0], [T(0.5), -4, 'inout'], [exit, -4, 'snap'], [T(2.2), 8, D.settle], [back, 0]] },
        head: {
          r: [[0, 0, 'inout'], [T(0.55), 7 * A, 'inout'], [exit, 8 * A, 'snap'], [T(2.2), -2, D.settle], [back, 0]],
          y: [[0, 0], [T(0.55), 2, 'inout'], [exit, 2, 'snap'], [T(2.05), -5, D.settle], [back, 0]],
        },
        pupils: {
          x: [[0, 0], [T(0.15), 0, 'snap'], [T(0.3), -7], [exit, -7, 'snap'], [T(2.05), 0]],
          y: [[0, 0], [T(0.15), 0, 'snap'], [T(0.3), -7], [exit, -7, 'snap'], [T(2.05), 0]],
        },
        eyes: { sy: [[0, 1], [T(0.3), 0.88], [exit, 0.88, 'snap'], [T(2.05), 1.12, 'out'], [T(2.3), 1]] },
        brow_l: {
          y: [[0, 0], [T(0.3), -9, D.settle], [exit, -9, 'snap'], [T(2.1), -12, D.settle], [T(2.4), 0]],
          r: [[0, 0], [T(0.3), 6], [exit, 6, 'snap'], [T(2.1), 0]],
        },
        brow_r: {
          y: [[0, 0], [T(0.3), 4, 'out'], [exit, 4, 'snap'], [T(2.1), -12, D.settle], [T(2.4), 0]],
          r: [[0, 0], [T(0.3), 8], [exit, 8, 'snap'], [T(2.1), 0]],
        },
      },
      swaps: { mouth: [[0, 'smile'], [T(0.25), 'flat'], [T(1.05), 'u'], [T(1.6), 'flat'], [exit + 0.05, 'o'], [T(2.25), 'smile']] },
    };
    return freeHand(m, 'r', def);
  };

  // ---------- talk: loop, irregular visemes + nods and brow accents on stressed syllables ----------
  M.talk = (D, def) => {
    const A = Math.min(D.amp, 1.1);
    const gestL = [[0, 2], [0.5, 2, 'snap'], [0.72, 32 * A, D.settle], [1.5, 32 * A, 'inout'], [1.9, 2, 'inout'], [2.4, 2]];
    const gestF = [[0, -3], [0.5, -3, 'snap'], [0.78, -100 * A, D.settle], [1.2, -88 * A, 'inout'], [1.5, -100 * A, 'inout'], [1.9, -3, 'inout'], [2.4, -3]];
    const brow = [[0, 0], [0.08, -6, 'out'], [0.4, 0, 'inout'], [0.93, -7, 'out'], [1.3, 0, 'inout'], [2.4, 0]];
    return freeHand({
      duration: 2.4,
      loop: true,
      tracks: {
        body: { ss: [[0, 1, 'inout'], [0.95, 1.012, 'inout'], [1.9, 1, 'inout'], [2.4, 1]] },
        head: {
          r: [[0, 0, 'inout'], [0.2, -3, 'inout'], [0.6, 2, 'inout'], [1.0, -2, 'inout'], [1.4, 3, 'inout'], [1.9, 0, 'inout'], [2.4, 0]],
          y: [[0, 0], [0.1, -3, 'out'], [0.3, 0, 'inout'], [0.95, -4, 'out'], [1.2, 0, 'inout'], [2.4, 0]],
        },
        arm_l: { r: gestL },
        fore_l: { r: gestF },
        arm_r: { r: [[0, -3, 'inout'], [1.2, -5, 'inout'], [2.4, -3]] },
        eyes: { sy: [[0, 1], [1.6, 1, 'in'], [1.667, 0.1, 'hold'], [1.7, 0.1, 'out'], [1.8, 1], [2.4, 1]] },
        brow_l: { y: brow },
        brow_r: { y: brow },
      },
      swaps: {
        mouth: [[0, 'flat'], [0.1, 'open'], [0.22, 'wide'], [0.32, 'o'], [0.44, 'open'], [0.52, 'flat'], [0.62, 'wide'],
          [0.78, 'smile'], [0.95, 'grin'], [1.05, 'o'], [1.18, 'wide'], [1.3, 'open'], [1.42, 'flat'], [1.6, 'open'],
          [1.72, 'u'], [1.84, 'wide'], [1.95, 'flat']],
      },
    }, 'l', def);
  };

  // ---------- sneaky: loop, glance left/right (eyes lead the head by 3 frames), rub hands, tiptoe sway ----------
  M.sneaky = (D) => {
    const L = 3.6, lead = 0.1, A = Math.min(D.amp, 1.1);
    const rub = (base, amp) => {
      const keys = [];
      for (let t = 0; t <= L + 1e-6; t += 0.18) keys.push([+t.toFixed(3), base + (Math.round(t / 0.18) % 2 ? amp : -amp), 'inout']);
      keys[keys.length - 1][1] = keys[0][1];
      return keys;
    };
    const look = (v) => [[0, 0], [0.3, 0, 'snap'], [0.42, -v], [1.25, -v, 'snap'], [1.4, v], [2.25, v, 'snap'], [2.4, 0], [L, 0]];
    const follow = (v, e) => [[0, 0], [0.3 + lead, 0, e], [0.75, -v, 'inout'], [1.25 + lead, -v, e], [1.75, v, 'inout'], [2.25 + lead, v, e], [2.7, 0], [L, 0]];
    return {
      duration: L,
      loop: true,
      tracks: {
        body: { ss: [[0, 0.965, 'inout'], [0.9, 0.975, 'inout'], [1.8, 0.965, 'inout'], [2.7, 0.975, 'inout'], [L, 0.965]] },
        root: { x: follow(10 * A, D.main) },
        torso: { r: follow(3 * A, D.main).map(([t, v, e]) => [t, -v, e]) },
        head: { r: follow(7 * A, D.main), y: [[0, 6], [L, 6]] },
        pupils: { x: look(9), y: [[0, 1], [L, 1]] },
        // hands meet at the chest and rub (forearms out of phase)
        arm_l: { r: [[0, -18], [L, -18]] },
        arm_r: { r: [[0, 18], [L, 18]] },
        // -80 puts the hands side by side at the chest; -95 crossed them into a folded-arms "X"
        fore_l: { r: rub(-80, 6) },
        fore_r: { r: rub(80, -6) },
        brow_l: { r: [[0, 10], [L, 10]], y: [[0, 3], [L, 3]] },
        brow_r: { r: [[0, -10], [L, -10]], y: [[0, 3], [L, 3]] },
        eyes: { sy: [[0, 0.85], [2.9, 0.85, 'in'], [2.967, 0.1, 'hold'], [3.0, 0.1, 'out'], [3.1, 0.85], [L, 0.85]] },
      },
      swaps: { mouth: [[0, 'smile'], [2.4, 'grin'], [2.55, 'smile'], [2.7, 'grin'], [2.85, 'smile']] },
    };
  };

  // ---------- yawn: one-arm stretch, huge mouth, eyes squeezed, then a tired slump ----------
  M.yawn = (D, def) => {
    const T = (x) => x * D.tempo, up = -0.95 * D.armMax;
    const m = {
      duration: T(2.7),
      loop: false,
      tracks: {
        body: { ss: [[0, 1, 'inout'], [T(0.5), 1.04, 'inout'], [T(1.0), 1.06, 'inout'], [T(1.4), 1.05, 'out'], [T(1.8), 0.96, 'inout'], [T(2.5), 1]] },
        head: {
          y: [[0, 0, 'inout'], [T(0.5), -6, 'inout'], [T(1.3), -7, 'out'], [T(1.9), 6, 'inout'], [T(2.5), 0]],
          r: [[0, 0, 'inout'], [T(0.6), -5, 'inout'], [T(1.3), -6, 'out'], [T(1.9), 3, 'inout'], [T(2.5), 0]],
        },
        arm_r: { r: [[0, 0], [T(0.2), 0, 'inout'], [T(0.9), up, 'inout'], [T(1.05), up + 4, 'inout'], [T(1.2), up - 3, 'inout'], [T(1.4), up, 'out'], [T(1.95), 0, D.settle], [T(2.5), 0]] },
        fore_r: { r: [[0, 0], [T(0.3), 0, 'inout'], [T(0.95), -25, 'inout'], [T(1.4), -25, 'out'], [T(2.0), 0, D.settle]] },
        eyes: { sy: [[0, 1], [T(0.4), 0.6, 'snap'], [T(0.55), 0.1, 'inout'], [T(1.4), 0.1, 'out'], [T(1.6), 0.7, 'inout'], [T(2.3), 0.7, 'snap'], [T(2.45), 1]] },
        brow_l: { y: [[0, 0], [T(0.5), -7, 'inout'], [T(1.4), -7, 'out'], [T(1.8), 2, 'inout'], [T(2.5), 0]] },
        brow_r: { y: [[0, 0], [T(0.5), -7, 'inout'], [T(1.4), -7, 'out'], [T(1.8), 2, 'inout'], [T(2.5), 0]] },
        mouth: { sy: [[0, 1], [T(0.55), 1, 'out'], [T(0.75), 1.7, 'inout'], [T(1.35), 1.6, 'snap'], [T(1.45), 1]], sx: [[0, 1], [T(0.55), 1, 'out'], [T(0.75), 1.15, 'inout'], [T(1.35), 1.1, 'snap'], [T(1.45), 1]] },
      },
      swaps: { mouth: [[0, 'smile'], [T(0.2), 'o'], [T(0.55), 'open'], [T(1.45), 'flat'], [T(2.4), 'smile']] },
    };
    return freeHand(m, 'r', def);
  };

  // ---------- alert: small dip, hand snaps up palm-out ("请稍等"), two firm pats, release ----------
  M.alert = (D, def) => {
    const T = (x) => x * D.tempo, L = D.lag;
    const up = T(0.4), hold = T(1.6), back = T(2.1);
    const m = {
      duration: back + T(0.2),
      loop: false,
      tracks: {
        body: { ss: [[0, 1, 'snap'], [T(0.12), 0.97, 'out'], [up, 1.03, D.settle], [T(0.7), 1, 'inout'], [hold, 1, 'inout'], [back, 1]] },
        root: { x: [[0, 0], [T(0.12), 0, 'snap'], [up, 8, D.settle], [hold, 8, 'inout'], [back, 0]] },
        torso: { r: [[0, 0], [T(0.12), 0, 'snap'], [up, 3, D.settle], [hold, 3, 'inout'], [back, 0]] },
        // upper arm out ~60°, forearm vertical: hand beside the head, palm to camera
        arm_r: { r: [[0, 0], [T(0.12), 4, 'snap'], [up, -52, D.settle], [hold, -52, 'inout'], [back, 0, D.settle]] },
        fore_r: {
          // pats stay small (6°): bigger reads as waving hello instead of "wait"
          r: [[0, 0], [T(0.12) + L, 0, 'snap'], [up + L, -122, D.settle], [T(0.9), -122, 'inout'], [T(1.0), -116, 'inout'], [T(1.1), -122, 'inout'],
            [T(1.2), -116, 'inout'], [T(1.3), -122], [hold, -122, 'inout'], [back + L, 0, D.settle]],
        },
        arm_l: { r: [[0, 0], [up, -6, 'inout'], [hold, -6, 'inout'], [back, 0]] },
        head: {
          y: [[0, 0], [T(0.12), 3, 'snap'], [up + L, -3, D.settle], [T(0.95), 3, 'inout'], [T(1.15), 0, 'inout'], [back, 0]],
          r: [[0, 0], [up + L, -3, 'inout'], [hold, -3, 'inout'], [back, 0]],
        },
        // serious brows: inner ends down
        brow_l: { r: [[0, 0], [T(0.15), 10, 'snap'], [hold, 10, 'inout'], [back, 0]], y: [[0, 0], [T(0.15), 3], [hold, 3], [back, 0]] },
        brow_r: { r: [[0, 0], [T(0.15), -10, 'snap'], [hold, -10, 'inout'], [back, 0]], y: [[0, 0], [T(0.15), 3], [hold, 3], [back, 0]] },
        pupils: { x: [[0, 0], [T(0.1), 0, 'snap'], [T(0.2), 3], [hold, 3, 'snap'], [hold + 0.1, 0]] },
        eyes: { sy: [[0, 1], [T(0.12), 1, 'snap'], [T(0.22), 1.1, 'out'], [T(0.6), 1], [back, 1]] },
      },
      swaps: {
        mouth: [[0, 'smile'], [T(0.15), 'flat'], [T(0.45), 'open'], [T(0.6), 'wide'], [T(0.75), 'o'], [T(0.9), 'flat'], [hold + 0.1, 'smile']],
        hand_r: [[0, 'fist'], [T(0.25), 'palm'], [back - T(0.15), 'fist']],
      },
    };
    return freeHand(m, 'r', def);
  };

  // ---------- shock: flinch (squash, arms in) → pop (stretch, arms fly out, eyes wide, hair spikes) → frozen tremble → recover ----------
  M.shock = (D, def) => {
    // the part that stands up on end; def.hair = null → none (helmet, bald)
    const hair = def && 'hair' in def ? def.hair : 'hair_tuft';
    const T = (x) => x * D.tempo, L = D.lag, A = Math.min(D.amp, 1.1);
    const flinch = T(0.12), pop = T(0.28), freeze = T(0.95), back = T(1.45);
    const hop = D.tiptoe ? 6 : D.jumpH * 0.22;
    const spread = Math.min(D.armMax, 72 * A);
    // frozen tremble: small fast head jitter while the shock sinks in
    const jitter = [];
    for (let t = pop + 0.1, i = 0; t < freeze; t += 0.05, i++) jitter.push([t, i % 2 ? 1.6 : -1.6, 'inout']);
    const armL = [[0, 0], [flinch, -18, 'snap'], [pop, spread, D.settle], [freeze, spread - 8, D.main], [back, 0, D.settle]];
    const foreL = [[0, 0], [flinch + L, 8, 'snap'], [pop + L, -35, D.settle], [freeze, -30, D.main], [back + L, 0, D.settle]];
    const brow = [[0, 0], [flinch, 4, 'snap'], [pop, -15, D.settle], [freeze, -12, 'inout'], [back, 0]];
    return {
      duration: back + T(0.2),
      loop: false,
      tracks: {
        root: { y: [[0, 0], [flinch, 0, 'out'], [pop, -hop, 'in'], [T(0.46), 0, D.settle]] },
        body: {
          ss: [[0, 1, 'snap'], [flinch, 1 - 0.7 * D.squash, 'out'], [pop, 1 + 1.3 * D.stretch, 'in'], [T(0.46), 1 - 0.5 * D.squash, D.settle],
            [T(0.7), 1.02, 'inout'], [freeze, 1.02, 'inout'], [back, 1]],
        },
        head: {
          y: [[0, 0], [flinch + L, 8, 'snap'], [pop + L, -8, D.settle], [freeze, -4, 'inout'], [back + L, 0]],
          r: [[0, 0], [pop, 0], ...jitter, [freeze + 0.05, 0], [back, 0]],
        },
        arm_l: { r: armL },
        arm_r: { r: mirror(armL) },
        fore_l: { r: foreL },
        fore_r: { r: mirror(foreL) },
        eyes: { sy: [[0, 1], [flinch, 0.55, 'snap'], [pop, 1.35, D.settle], [freeze, 1.25, 'inout'], [back, 1]], sx: [[0, 1], [pop, 1.12, D.settle], [freeze, 1.08], [back, 1]] },
        brow_l: { y: brow },
        brow_r: { y: brow },
        ...(hair ? { [hair]: { r: [[0, 0], [flinch, 0, 'snap'], [pop, -22, D.settle], [freeze, -15, 'inout'], [back, 0]] } } : {}),
      },
      swaps: { mouth: [[0, 'smile'], [flinch, 'flat'], [pop, 'o'], [T(0.5), 'open'], [freeze, 'flat'], [back, 'smile']] },
    };
  };
  M.shock.burst = true;

  // ---------- speak@<cueId>: Rhubarb mouth cues → visemes + head/brow accents + pause blinks (references/lipsync.md) ----------
  M.speak = (D, def, cueId) => {
    const data = IPM.cues[cueId || 'sample'];
    if (!data) throw new Error('unknown cue set: ' + cueId);
    const LEAD = 0.05, MIN_HOLD = 2 / 30, A = Math.min(D.amp, 1.1);
    const MAP = { X: 'smile', A: 'flat', B: 'wide', C: 'open', D: 'grin', E: 'o', F: 'u', G: 'wide', H: 'open' };
    // merge cues shorter than 2 frames into the previous one (avoids flicker)
    const cues = [];
    for (const c of data.mouthCues) {
      const prev = cues[cues.length - 1];
      if (prev && c.end - c.start < MIN_HOLD && c.value !== 'X') prev.end = c.end;
      else cues.push(Object.assign({}, c));
    }
    const end = data.metadata && data.metadata.duration ? data.metadata.duration : cues[cues.length - 1].end;
    // mouth leads the sound by ~1.5 frames
    const mouth = cues.map((c) => [Math.max(0, c.start - LEAD), MAP[c.value] || 'flat']);
    // stressed syllables: open vowels held ≥ 0.1s, at least 0.4s apart → nod + brow lift
    const accents = [];
    for (const c of cues) {
      if ((c.value === 'C' || c.value === 'D') && c.end - c.start >= 0.1 && (!accents.length || c.start - accents[accents.length - 1] >= 0.4)) accents.push(c.start);
    }
    const headY = [[0, 0]], brow = [[0, 0]];
    for (const t of accents) {
      const t0 = Math.max(0.01, t - LEAD - 0.02);
      headY.push([t0, 0, 'snap'], [t - LEAD + 0.06, -4 * A, 'out'], [t + 0.3, 0, 'inout']);
      brow.push([t0, 0, 'snap'], [t - LEAD + 0.06, -6 * A, 'out'], [t + 0.3, 0, 'inout']);
    }
    // pauses ≥ 0.4s get a blink in the middle
    const eyes = [[0, 1]];
    for (const c of cues) {
      if (c.value === 'X' && c.end - c.start >= 0.4 && c.start > 0) {
        const m0 = (c.start + c.end) / 2 - 0.05;
        eyes.push([m0, 1, 'in'], [m0 + 0.067, 0.1, 'hold'], [m0 + 0.1, 0.1, 'out'], [m0 + 0.2, 1]);
      }
    }
    // slow head sway so it never sits dead still between accents
    const sway = [];
    for (let t = 0, i = 0; t <= end + 1e-6; t += 0.8, i++) sway.push([+t.toFixed(2), i % 2 ? 2 * A : -2 * A, 'inout']);
    sway[0][1] = 0;
    // one open-hand gesture on the first accent after 0.5s
    const g = accents.find((t) => t > 0.5);
    const tracks = {
      body: { ss: [[0, 1, 'inout'], [end / 2, 1.012, 'inout'], [end, 1]] },
      head: { y: headY, r: sway },
      brow_l: { y: brow },
      brow_r: { y: brow },
      eyes: { sy: eyes },
    };
    if (g !== undefined) {
      const out = Math.min(g + 1.4, end - 0.3);
      tracks.arm_l = { r: [[0, 0], [g - 0.25, 0, 'snap'], [g, 30 * A, D.settle], [out, 30 * A, 'inout'], [out + 0.35, 0, D.settle]] };
      tracks.fore_l = { r: [[0, 0], [g - 0.2, 0, 'snap'], [g + 0.05, -95 * A, D.settle], [out, -90 * A, 'inout'], [out + 0.4, 0, D.settle]] };
    }
    return freeHand({ duration: end, loop: false, tracks, swaps: { mouth } }, 'l', def);
  };

  // ---------- phone_look: pull out the shared phone and use it — one template, four personalities ----------
  //   bouncy → scrolls with thumb flicks and laughs   slow  → squints up close, then holds it at arm's length
  //   sly    → glances, then holds it out to the mark  other → checks it, then looks up
  M.phone_look = (D, def) => {
    const T = (x) => x * D.tempo, L = D.lag, A = Math.min(D.amp, 1.1);
    const raise = T(0.5), lower = T(2.1), back = T(2.6);
    const mode = { bouncy: 'scroll', slow: 'squint', sly: 'offer' }[D.style] || 'check';
    // phone held at chin/chest height: upper arm swung in, forearm folded up (folding further covered the mouth)
    const HOLD_A = 30, HOLD_F = 95;
    const tr = {
      arm_r: { r: [[0, 0, 'snap'], [T(0.08), -5, 'snap'], [raise, HOLD_A, D.settle], [lower, HOLD_A, D.main], [back, 0, D.settle]] },
      fore_r: { r: [[0, 0, 'snap'], [T(0.12) + L, 0, 'snap'], [raise + L, HOLD_F, D.settle], [lower, HOLD_F, D.main], [back + L, 0, D.settle]] },
      head: { y: [[0, 0], [raise, 5, 'inout'], [lower, 5, 'inout'], [back, 0]], r: [[0, 0], [raise, 3, 'inout'], [lower, 3, 'inout'], [back, 0]] },
      pupils: { x: [[0, 0], [T(0.2), 0, 'snap'], [T(0.32), 4], [lower, 4, 'snap'], [lower + 0.12, 0]], y: [[0, 0], [T(0.2), 0, 'snap'], [T(0.32), 6], [lower, 6, 'snap'], [lower + 0.12, 0]] },
    };
    const sw = { prop_phone: [[0, 'off'], [T(0.1), 'on'], [back - T(0.05), 'off']], mouth: [[0, 'smile']] };
    if (mode === 'scroll') {
      const flick = [[0, 0, 'snap'], [T(0.12) + L, 0, 'snap'], [raise + L, HOLD_F, D.settle]];
      for (let t = raise + 0.25, i = 0; t < lower - 0.1; t += 0.22, i++) flick.push([t, i % 2 ? HOLD_F : HOLD_F - 8, 'snap']);
      flick.push([lower, HOLD_F, D.main], [back + L, 0, D.settle]);
      tr.fore_r.r = flick;
      tr.body = { ss: [[0, 1], [T(1.2), 1, 'snap'], [T(1.3), 0.95, 'out'], [T(1.42), 1.04, D.settle], [T(1.7), 1]] };
      tr.root = { y: [[0, 0], [T(1.3), 0, 'out'], [T(1.42), -10, 'in'], [T(1.56), 0]] };
      tr.eyes = { sy: [[0, 1], [T(1.25), 1, 'snap'], [T(1.35), 0.5, 'out'], [T(1.9), 0.5], [T(2.05), 1]] };
      sw.mouth = [[0, 'smile'], [T(1.25), 'grin'], [T(1.95), 'smile']];
    } else if (mode === 'squint') {
      // close to the face, squinting … then pushed out to arm's length, head back, eyes wide
      tr.arm_r.r = [[0, 0, 'snap'], [T(0.08), -5, 'snap'], [raise, 35, D.settle], [T(1.1), 35, 'inout'], [T(1.5), 12, D.settle], [lower, 12, D.main], [back, 0, D.settle]];
      tr.fore_r.r = [[0, 0, 'snap'], [T(0.12) + L, 0, 'snap'], [raise + L, 140, D.settle], [T(1.1), 140, 'inout'], [T(1.5), 100, D.settle], [lower, 100, D.main], [back + L, 0, D.settle]];
      tr.head.y = [[0, 0], [raise, 7, 'inout'], [T(1.1), 7, 'inout'], [T(1.5), -4, 'out'], [lower, -4, 'inout'], [back, 0]];
      tr.eyes = { sy: [[0, 1], [raise, 0.45, 'inout'], [T(1.1), 0.45, 'snap'], [T(1.3), 1.15, 'out'], [lower, 1.05], [back, 1]] };
      tr.brow_l = { r: [[0, 0], [raise, 8, 'inout'], [T(1.1), 8, 'snap'], [T(1.3), 0], [back, 0]], y: [[0, 0], [raise, 3], [T(1.1), 3, 'snap'], [T(1.3), -8, 'out'], [lower, -6], [back, 0]] };
      tr.brow_r = { r: [[0, 0], [raise, -8, 'inout'], [T(1.1), -8, 'snap'], [T(1.3), 0], [back, 0]], y: [[0, 0], [raise, 3], [T(1.1), 3, 'snap'], [T(1.3), -8, 'out'], [lower, -6], [back, 0]] };
      sw.mouth = [[0, 'smile'], [raise, 'u'], [T(1.3), 'o'], [T(1.8), 'smile']];
    } else if (mode === 'offer') {
      // a sly glance at the screen, then the arm swings out to hold the phone toward the mark
      tr.arm_r.r = [[0, 0, 'snap'], [T(0.08), -5, 'snap'], [raise, HOLD_A, D.settle], [T(1.0), HOLD_A, D.main], [T(1.35), -68 * A, D.settle], [lower, -68 * A, D.main], [back, 0, D.settle]];
      tr.fore_r.r = [[0, 0, 'snap'], [T(0.12) + L, 0, 'snap'], [raise + L, HOLD_F, D.settle], [T(1.0), HOLD_F, D.main], [T(1.4) + L, 10, D.settle], [lower, 10, D.main], [back + L, 0, D.settle]];
      tr.pupils.x = [[0, 0], [T(0.2), 0, 'snap'], [T(0.32), 4], [T(0.95), 4, 'snap'], [T(1.05), 9], [lower, 9, 'snap'], [lower + 0.12, 0]];
      tr.pupils.y = [[0, 0], [T(0.2), 0, 'snap'], [T(0.32), 6], [T(0.95), 6, 'snap'], [T(1.05), 0], [back, 0]];
      tr.head.y = [[0, 0], [raise, 5, 'inout'], [T(1.0), 5, D.main], [T(1.35), -2, D.settle], [lower, -2], [back, 0]];
      tr.head.r = [[0, 0], [raise, 3, 'inout'], [T(1.0), 3, D.main], [T(1.35), 6, D.settle], [lower, 6], [back, 0]];
      tr.root = { x: [[0, 0], [T(1.0), 0, D.main], [T(1.35), 8, D.settle], [lower, 8, 'inout'], [back, 0]] };
      tr.brow_l = { y: [[0, 0], [T(1.05), 0, 'snap'], [T(1.2), -7, 'out'], [lower, -7], [back, 0]] };
      sw.mouth = [[0, 'smile'], [T(1.2), 'grin'], [T(1.5), 'smile']];
    } else {
      // check: read it, then look up from the screen (brows lift)
      tr.pupils.y = [[0, 0], [T(0.2), 0, 'snap'], [T(0.32), 6], [T(1.5), 6, 'snap'], [T(1.62), -2], [lower, -2, 'snap'], [lower + 0.12, 0]];
      tr.pupils.x = [[0, 0], [T(0.2), 0, 'snap'], [T(0.32), 4], [T(1.5), 4, 'snap'], [T(1.62), 0]];
      tr.head.y = [[0, 0], [raise, 5, 'inout'], [T(1.5), 5, 'snap'], [T(1.7), -2, D.settle], [lower, -2], [back, 0]];
      tr.brow_l = { y: [[0, 0], [T(1.5), 0, 'snap'], [T(1.65), -6, 'out'], [lower, -4], [back, 0]] };
      tr.brow_r = { y: [[0, 0], [T(1.5), 0, 'snap'], [T(1.65), -6, 'out'], [lower, -4], [back, 0]] };
      sw.mouth = [[0, 'smile'], [raise, 'flat'], [T(1.6), 'o'], [T(1.85), 'smile']];
    }
    return freeHand({ duration: back + T(0.15), loop: false, tracks: tr, swaps: sw }, 'r', def);
  };

  // ---------- seq@a+b+c: chain motions into one clip ----------
  // Keys of every segment are laid on one timeline with a BLEND gap between segments, bridged by an
  // 'inout' ease — so joins are interpolated, and springs (hair, bags) simulate continuously across them.
  // Loops repeat with a _xN suffix (idle_x2); inner arguments keep working (idle@1, speak@sample).
  M.seq = (D, def, arg) => {
    const BLEND = 0.2; // default bridge; adapted per seam below
    const p = def.profile || {};
    const segs = (arg || 'idle').split('+').map((item) => {
      const rep = /_x(\d+)$/.exec(item);
      const name = rep ? item.slice(0, rep.index) : item;
      const at = name.indexOf('@');
      const base = at < 0 ? name : name.slice(0, at), sub = at < 0 ? undefined : name.slice(at + 1);
      const tpl = M[base];
      if (!tpl || base === 'seq') throw new Error('seq: unknown motion ' + name);
      const Dm = tpl.burst && p.burst != null ? IPM.derive(Object.assign({}, p, { energy: p.burst })) : D;
      const m = tpl(Dm, def, sub);
      return { m, times: rep ? +rep[1] : 1 };
    });
    // adaptive blend: the further apart the arm poses at a seam, the longer the bridge (0.15–0.4s).
    // A fixed 0.2s dropped rubbing hands to the sides in ~3 frames (scammer sneaky → speak).
    const edge = (m, prop, last) => {
      const v = {};
      for (const part of ['arm_l', 'arm_r', 'fore_l', 'fore_r']) {
        const k = m.tracks[part] && m.tracks[part][prop];
        if (!k) { v[part] = 0; continue; }
        const sorted = k.slice().sort((a, b) => a[0] - b[0]);
        v[part] = (last ? sorted[sorted.length - 1] : sorted[0])[1];
      }
      return v;
    };
    let t0 = 0;
    segs.forEach((s, i) => {
      s.start = t0;
      s.len = s.m.duration * s.times;
      let blend = BLEND;
      if (i + 1 < segs.length) {
        const a = edge(s.m, 'r', true), b = edge(segs[i + 1].m, 'r', false);
        const diff = Math.max(...Object.keys(a).map((k) => Math.abs(a[k] - b[k])));
        blend = Math.min(0.4, Math.max(0.15, 0.15 + (diff / 100) * 0.25));
      }
      s.blend = blend;
      t0 += s.len + blend;
    });
    const total = t0 - segs[segs.length - 1].blend;
    const tracks = {}, swaps = {};
    const parts = new Set(), groups = new Set();
    for (const s of segs) {
      for (const part in s.m.tracks) for (const prop in s.m.tracks[part]) parts.add(part + '.' + prop);
      for (const g in s.m.swaps || {}) groups.add(g);
    }
    for (const key of parts) {
      const [part, prop] = key.split('.');
      const out = [];
      for (const s of segs) {
        const src = s.m.tracks[part] && s.m.tracks[part][prop];
        const keys = src ? src.slice().sort((a, b) => a[0] - b[0]) : [[0, IPM.DEFAULTS[prop]], [s.m.duration, IPM.DEFAULTS[prop]]];
        for (let n = 0; n < s.times; n++) {
          const off = s.start + n * s.m.duration;
          for (const [t, v, e] of keys) if (t <= s.m.duration + 1e-6) out.push([off + t, v, e]);
          // hold the last value to the end of the segment, then bridge into the next one
          out.push([off + s.m.duration, keys[keys.length - 1][1], 'bridge']);
        }
      }
      tracks[part] = tracks[part] || {};
      tracks[part][prop] = out;
    }
    // position continuity: each segment's root.x is shifted to start where the previous one stopped,
    // so "walk_across + dance + walk_across@l" dances where it arrived instead of sliding back to centre
    let prevEnd = null; // the first segment keeps its own position
    for (const s of segs) {
      const k = s.m.tracks.root && s.m.tracks.root.x;
      const x0 = k ? IPM.evalKeys(k, 0) : 0, x1 = k ? IPM.evalKeys(k, s.m.duration) : 0;
      s.dx = prevEnd === null ? 0 : prevEnd - x0;
      prevEnd = x1 + s.dx;
    }
    if (segs.some((s) => s.dx)) {
      const out = [];
      for (const s of segs) {
        const k = s.m.tracks.root && s.m.tracks.root.x;
        const keys = k ? k.slice().sort((a, b) => a[0] - b[0]) : [[0, 0], [s.m.duration, 0]];
        for (let n = 0; n < s.times; n++) {
          const off = s.start + n * s.m.duration;
          for (const [t, v, e] of keys) if (t <= s.m.duration + 1e-6) out.push([off + t, v + s.dx, e]);
          out.push([off + s.m.duration, keys[keys.length - 1][1] + s.dx, 'bridge']);
        }
      }
      tracks.root = tracks.root || {};
      tracks.root.x = out;
    }
    for (const g of groups) {
      const out = [];
      for (const s of segs) {
        const src = s.m.swaps && s.m.swaps[g];
        for (let n = 0; n < s.times; n++) {
          const off = s.start + n * s.m.duration;
          if (src) for (const [t, v] of src) out.push([off + t, v]);
          else out.push([off, null]); // missing group → character default
        }
      }
      swaps[g] = out;
    }
    return { duration: total, loop: false, tracks, swaps };
  };

  // =====================================================================================================
  // Locomotion. Front-facing cartoon walk: legs lift by shortening (sy around the hip), body dips at each
  // contact and rises at passing, weight shifts over the standing leg, arms swing opposite the legs.
  // =====================================================================================================
  const GAIT = {
    bouncy: { step: 0.9, lift: 0.2, bob: 9, sway: 2, arm: 14, crouch: 0, head: 0 }, // springy, can't help bouncing
    steady: { step: 1.0, lift: 0.15, bob: 4, sway: 2, arm: 9, crouch: 0, head: 0 }, // neat, even
    sly: { step: 1.3, lift: 0.26, bob: 3, sway: 3, arm: 3, crouch: 5, head: 3 }, // high-knee tiptoe sneak, hunched
    tired: { step: 1.15, lift: 0.08, bob: 3, sway: 3, arm: 5, crouch: 2, head: 7 }, // feet drag, head hangs
    slow: { step: 1.4, lift: 0.06, bob: 2, sway: 5, arm: 4, crouch: 3, head: 3 }, // shuffle, rocking side to side
    waddle: { step: 0.75, lift: 0.05, bob: 2, sway: 7, arm: 10, crouch: 0, head: 0, strideK: 0.6 }, // quick tiny steps, big side-to-side rock, flippers flap
  };
  const gait = (D) => {
    const g = GAIT[D.style] || GAIT.steady;
    const P = 0.36 * D.tempo * g.step; // one step; a cycle is two
    return Object.assign({}, g, { P, stride: 55 * (0.6 + 0.8 * D.energy) * (g.strideK || 1) });
  };

  // one walk cycle (left step, right step) starting at t0; returns per-track key lists
  function walkCycle(D, g, t0, out) {
    const P = g.P, A = Math.min(D.amp, 1.1);
    const push = (part, prop, keys) => {
      out[part] = out[part] || {};
      (out[part][prop] = out[part][prop] || []).push(...keys.map(([t, v, e]) => [t0 + t, v, e]));
    };
    const lift = (on) => (on === 0 ? [[0, 1, 'out'], [P / 2, 1 - g.lift, 'in'], [P, 1], [2 * P, 1]] : [[0, 1], [P, 1, 'out'], [1.5 * P, 1 - g.lift, 'in'], [2 * P, 1]]);
    push('leg_l', 'sy', lift(0));
    push('leg_r', 'sy', lift(1));
    // lifted leg kicks out a touch
    push('leg_l', 'r', [[0, 0, 'out'], [P / 2, 4, 'in'], [P, 0], [2 * P, 0]]);
    push('leg_r', 'r', [[0, 0], [P, 0, 'out'], [1.5 * P, -4, 'in'], [2 * P, 0]]);
    // contact low, passing high (rise decelerates, fall accelerates)
    push('root', 'y', [[0, g.crouch, 'out'], [P / 2, g.crouch - g.bob, 'in'], [P, g.crouch, 'out'], [1.5 * P, g.crouch - g.bob, 'in'], [2 * P, g.crouch]]);
    push('body', 'ss', [[0, 0.97, 'out'], [P / 2, 1.02, 'in'], [P, 0.97, 'out'], [1.5 * P, 1.02, 'in'], [2 * P, 0.97]]);
    // weight over the standing leg; head counter-tilts a beat later
    push('torso', 'r', [[0, 0, 'inout'], [P / 2, g.sway, 'inout'], [P, 0, 'inout'], [1.5 * P, -g.sway, 'inout'], [2 * P, 0]]);
    push('head', 'r', [[0, 0, 'inout'], [P / 2 + D.lag, -g.sway * 0.6, 'inout'], [P + D.lag, 0, 'inout'], [1.5 * P + D.lag, g.sway * 0.6, 'inout'], [2 * P, 0]]);
    // arms swing opposite the legs (same sign on both arms = one out, one in)
    const sw = g.arm * A;
    push('arm_l', 'r', [[0, 0, 'inout'], [P / 2, -sw, 'inout'], [P, 0, 'inout'], [1.5 * P, sw, 'inout'], [2 * P, 0]]);
    push('arm_r', 'r', [[0, 0, 'inout'], [P / 2, -sw, 'inout'], [P, 0, 'inout'], [1.5 * P, sw, 'inout'], [2 * P, 0]]);
  }

  // ---------- walk: loop in place ----------
  M.walk = (D) => {
    const g = gait(D);
    const tracks = {};
    walkCycle(D, g, 0, tracks);
    tracks.head.y = [[0, g.head, 'inout'], [g.P, g.head + 1, 'inout'], [2 * g.P, g.head]];
    if (D.style === 'sly') tracks.pupils = { x: [[0, -6], [g.P * 0.9, -6, 'snap'], [g.P * 1.1, 6], [g.P * 1.9, 6, 'snap'], [2 * g.P, -6]] };
    return { duration: 2 * g.P, loop: true, tracks, swaps: { mouth: [[0, D.style === 'tired' ? 'flat' : 'smile']] } };
  };

  // ---------- walk_across[@l|@r]: start still, walk across the frame (±120px), stop ----------
  // root.x is the one track allowed to move linearly: constant travel speed between the start and stop steps.
  M.walk_across = (D, def, dir) => {
    // ±120px keeps raised arms inside the 600px frame at either end (±200 clipped the dance at the edge)
    const g = gait(D), P = g.P, W = 120, sgn = dir === 'l' ? -1 : 1;
    let n = Math.max(4, Math.round((2 * W) / g.stride) + 1);
    if (n % 2) n++;
    const v = (2 * W) / ((n - 1) * P);
    const tracks = {};
    for (let c = 0; c < n / 2; c++) walkCycle(D, g, c * 2 * P, tracks);
    const end = n * P;
    // accelerate over the first step, cruise, decelerate over the last
    const x = [[0, -W * sgn, 'in'], [P, (-W + (v * P) / 2) * sgn, 'linear'], [end - P, (W - (v * P) / 2) * sgn, 'out'], [end, W * sgn]];
    tracks.root.x = x;
    // face the way it's going: eyes lead, head turns a little
    tracks.pupils = { x: [[0, 0], [0.05, 0, 'snap'], [0.2, 7 * sgn], [end - 0.2, 7 * sgn, 'snap'], [end, 0]] };
    tracks.head.y = [[0, 0, 'inout'], [P, g.head, 'inout'], [end - P, g.head, 'inout'], [end, 0]];
    // settle: stand up straight out of the last contact (it ended squashed / crouched — lint: end-pose)
    const hold = end + 0.35;
    tracks.body.ss.push([end + 0.3, 1]);
    tracks.root.y.push([end + 0.3, 0]);
    return { duration: hold, loop: false, travel: true, tracks, swaps: { mouth: [[0, 'smile'], [P, D.style === 'tired' ? 'flat' : 'smile'], [end, 'smile']] } };
  };

  // =====================================================================================================
  // Dances & fun poses
  // =====================================================================================================

  // ---------- dance: party bounce at 120 BPM — down on the beat, alternating fist pumps, hip sway ----------
  M.dance = (D) => {
    const beat = 0.5, L = 4 * beat, A = Math.min(D.amp, 1.1);
    const up = Math.min(D.armMax, 115 * A), dip = 4 + 6 * D.energy;
    const ss = [], rootY = [], headY = [], armL = [], armR = [], foreL = [], foreR = [], torso = [];
    for (let b = 0; b < 4; b++) {
      const t = b * beat;
      // down on the beat (snap), spring back up between beats
      ss.push([t, 0.93, 'out'], [t + beat * 0.5, 1.03, 'in']);
      rootY.push([t, dip, 'out'], [t + beat * 0.5, -dip * 0.6, 'in']);
      headY.push([t + D.lag, 5, 'out'], [t + beat * 0.5 + D.lag, -2, 'in']);
      // fist pump: left on beats 1 & 3, right on 2 & 4
      const left = b % 2 === 0;
      (left ? armL : armR).push([t, 20 * (left ? 1 : -1), 'snap'], [t + beat * 0.35, up * (left ? 1 : -1), 'inout']);
      (left ? armR : armL).push([t, 15 * (left ? -1 : 1), 'inout']);
      (left ? foreL : foreR).push([t, 0, 'snap'], [t + beat * 0.35, 40 * (left ? 1 : -1), 'inout']);
      (left ? foreR : foreL).push([t, 0, 'inout']);
      torso.push([t, (left ? 4 : -4) * A, 'inout']);
    }
    const close = (k) => k.concat([[L, k[0][1]]]);
    return {
      duration: L,
      loop: true,
      tracks: {
        body: { ss: close(ss) },
        root: { y: close(rootY) },
        head: { y: close(headY), r: close(torso.map(([t, v, e]) => [t + D.lag, -v * 0.7, e])) },
        torso: { r: close(torso) },
        arm_l: { r: close(armL.sort((a, b) => a[0] - b[0])) },
        arm_r: { r: close(armR.sort((a, b) => a[0] - b[0])) },
        fore_l: { r: close(foreL.sort((a, b) => a[0] - b[0])) },
        fore_r: { r: close(foreR.sort((a, b) => a[0] - b[0])) },
        eyes: { sy: [[0, 0.6], [L, 0.6]] },
        brow_l: { y: [[0, -6], [L, -6]] },
        brow_r: { y: [[0, -6], [L, -6]] },
      },
      swaps: { mouth: [[0, 'grin']] },
    };
  };

  // ---------- floss: arms swing straight side to side across the body, hips go the other way ----------
  M.floss = (D) => {
    const c = 0.22 * D.tempo, L = 8 * c, A = Math.min(D.amp, 1.1);
    const arm = 42 * A, hip = 9 * A;
    const armL = [], armR = [], rootX = [], torso = [], bounce = [];
    for (let i = 0; i < 8; i++) {
      bounce.push([i * c, 0, 'out'], [i * c + c / 2, -4, 'in']);
      const s = i % 2 ? -1 : 1; // arms to the right (+) / left (−) of the body
      armL.push([i * c, -s * arm, 'inout']);
      armR.push([i * c, -s * arm, 'inout']);
      rootX.push([i * c, s * hip, 'inout']);
      torso.push([i * c, -s * 3 * A, 'inout']);
    }
    const close = (k) => k.concat([[L, k[0][1]]]);
    return {
      duration: L,
      loop: true,
      tracks: {
        arm_l: { r: close(armL) },
        arm_r: { r: close(armR) },
        root: { x: close(rootX), y: close(bounce) },
        torso: { r: close(torso) },
        head: { r: close(torso.map(([t, v, e]) => [t, -v, e])), y: [[0, 2], [L, 2]] },
        body: { ss: [[0, 0.98], [L, 0.98]] },
        brow_l: { y: [[0, -5], [L, -5]] },
        brow_r: { y: [[0, -5], [L, -5]] },
      },
      swaps: { mouth: [[0, 'grin']] },
    };
  };

  // ---------- dab: dip → snap into the dab (face in one elbow, other arm straight up-out) → hold → release ----------
  M.dab = (D, def) => {
    const T = (x) => x * D.tempo, L = D.lag, hair = def && 'hair' in def ? def.hair : 'hair_tuft';
    const dip = T(0.15), hit = T(0.28), hold = T(1.1), back = T(1.55);
    const out = -Math.min(D.armMax, 125);
    return {
      duration: back + T(0.2),
      loop: false,
      tracks: {
        body: { ss: [[0, 1, 'snap'], [dip, 0.93, 'out'], [hit, 1.04, D.settle], [T(0.5), 1, 'inout'], [hold, 1, D.main], [back, 1]] },
        root: { y: [[0, 0], [dip, 4, 'out'], [hit, 0, D.settle], [back, 0]] },
        // right arm straight up and out; left arm folded across the face
        arm_r: { r: [[0, 0, 'snap'], [dip, 8, 'snap'], [hit, out, D.settle], [hold, out, D.main], [back, 0, D.settle]] },
        fore_r: { r: [[0, 0], [hit + L, -8, D.settle], [hold, -8, D.main], [back + L, 0, D.settle]] },
        arm_l: { r: [[0, 0, 'snap'], [dip, 8, 'snap'], [hit, -110, D.settle], [hold, -110, D.main], [back, 0, D.settle]] },
        fore_l: { r: [[0, 0, 'snap'], [dip + L, 0, 'snap'], [hit + L, -60, D.settle], [hold, -60, D.main], [back + L, 0, D.settle]] },
        head: { r: [[0, 0], [dip, 0, 'snap'], [hit + L, -10, D.settle], [hold, -10, D.main], [back, 0]], y: [[0, 0], [hit + L, 8, D.settle], [hold, 8, D.main], [back, 0]] },
        eyes: { sy: [[0, 1], [hit, 1, 'snap'], [hit + 0.06, 0.1, 'hold'], [hold, 0.1, 'snap'], [hold + 0.1, 1]] },
        ...(hair ? { [hair]: { r: [[0, 0], [hit, 0, 'snap'], [hit + 0.1, 12, D.settle], [hold, 0]] } } : {}),
      },
      swaps: { mouth: [[0, 'smile'], [hit, 'grin'], [hold, 'smile']] },
    };
  };

  // ---------- hero: crouch → pop up into hands-on-hips, chest out, chin up → hold → relax ----------
  M.hero = (D) => {
    const T = (x) => x * D.tempo, L = D.lag;
    const dip = T(0.18), hit = T(0.36), hold = T(1.5), back = T(1.95);
    // upper arm out ~40°, forearm folded in so the hand lands on the hip
    const armL = [[0, 0, 'snap'], [dip, -8, 'snap'], [hit, 40, D.settle], [hold, 40, D.main], [back, 0, D.settle]];
    const foreL = [[0, 0, 'snap'], [dip + L, 0, 'snap'], [hit + L, -80, D.settle], [hold, -80, D.main], [back + L, 0, D.settle]];
    return {
      duration: back + T(0.2),
      loop: false,
      tracks: {
        body: { ss: [[0, 1, 'snap'], [dip, 1 - 0.8 * D.squash, 'out'], [hit, 1.06, D.settle], [T(0.6), 1.04, 'inout'], [hold, 1.04, D.main], [back, 1]] },
        root: { y: [[0, 0], [dip, 0, 'out'], [hit, -D.jumpH * 0.15, 'in'], [T(0.52), 0, D.settle], [back, 0]] },
        arm_l: { r: armL },
        arm_r: { r: mirror(armL) },
        fore_l: { r: foreL },
        fore_r: { r: mirror(foreL) },
        head: { y: [[0, 0], [dip, 5, 'snap'], [hit + L, -5, D.settle], [hold, -5, D.main], [back, 0]], r: [[0, 0], [hit + L, -4, D.settle], [hold, -4, 'inout'], [back, 0]] },
        pupils: { y: [[0, 0], [hit, 0, 'snap'], [hit + 0.1, -3], [hold, -3, 'snap'], [hold + 0.1, 0]], x: [[0, 0], [hit, 0, 'snap'], [hit + 0.1, 4], [hold, 4, 'snap'], [hold + 0.1, 0]] },
        brow_l: { y: [[0, 0], [hit, 2, 'snap'], [hold, 2], [back, 0]], r: [[0, 0], [hit, 6, 'snap'], [hold, 6], [back, 0]] },
        brow_r: { y: [[0, 0], [hit, 2, 'snap'], [hold, 2], [back, 0]], r: [[0, 0], [hit, -6, 'snap'], [hold, -6], [back, 0]] },
      },
      swaps: { mouth: [[0, 'smile'], [dip, 'flat'], [hit, 'grin'], [T(0.8), 'smile']] },
    };
  };
  // ---------- robot: 8 counts of pop-and-lock — snap into each pose in 0.07s, lock (overshoot), hold; rigid body ----------
  //            arm_l  fore_l  arm_r  fore_r  head  torso  x
  const ROBOT = [
    [90, 90, -90, 90, 0, 0, 0], //  L forearm up, R forearm down
    [90, -90, -90, -90, 0, 0, 0], // swap
    [90, 90, -90, -90, 8, 0, 0], //   both up, head ticks right
    [90, -90, -90, 90, -8, 0, 0], //  both down, head ticks left
    [30, 100, -30, -100, 0, 4, -8], // forearms up in front, step left
    [30, 100, -30, -100, 0, -4, 8], // step right
    [60, 0, -60, 0, 8, 0, 0], //      arms straight down-out
    [10, 0, -10, 0, 0, 0, 0], //      reset
  ];
  M.robot = (D) => {
    const c = 0.28, L = 8 * c, A = Math.min(D.amp, 1.1);
    const lim = (v) => Math.max(-D.armMax, Math.min(D.armMax, v));
    const col = (j, scale) => {
      const keys = [];
      for (let i = 0; i < 8; i++) {
        const prev = ROBOT[(i + 7) % 8][j] * scale, cur = ROBOT[i][j] * scale;
        keys.push([i * c, prev, 'overshoot'], [i * c + 0.07, cur, 'hold']);
      }
      keys.push([L, ROBOT[7][j] * scale]);
      return keys;
    };
    const jolt = [];
    for (let i = 0; i < 8; i++) jolt.push([i * c + 0.07, -2, 'out'], [i * c + 0.16, 0, 'hold']);
    return {
      duration: L,
      loop: true,
      tracks: {
        arm_l: { r: col(0, 1).map(([t, v, e]) => [t, lim(v), e]) },
        fore_l: { r: col(1, 1) },
        arm_r: { r: col(2, 1).map(([t, v, e]) => [t, lim(v), e]) },
        fore_r: { r: col(3, 1) },
        head: { r: col(4, A), y: [[0, 0], ...jolt, [L, 0]] },
        torso: { r: col(5, A) },
        root: { x: col(6, A) },
        eyes: { sy: [[0, 0.7], [L, 0.7]] },
        brow_l: { r: [[0, 0], [L, 0]], y: [[0, 2], [L, 2]] },
        brow_r: { r: [[0, 0], [L, 0]], y: [[0, 2], [L, 2]] },
      },
      swaps: { mouth: [[0, 'flat']] },
    };
  };
  M.robot.burst = true;

  // ---------- moonwalk[@r]: glide backwards across the frame — no bob at all, feet alternate heel-up ----------
  // Ends up on the toes with one arm flung out ("hee-hee"), then relaxes.
  M.moonwalk = (D, def, dir) => {
    const sgn = dir === 'r' ? 1 : -1, W = 120;
    const P = 0.4 * Math.sqrt(D.tempo), n = 8, A = Math.min(D.amp, 1.1);
    const g0 = 0.3, g1 = g0 + n * P, toe = g1 + 0.15, hold = toe + 0.55, end = hold + 0.4;
    const legL = [[0, 1]], legR = [[0, 1]], armL = [[0, 0]], armR = [[0, 0]], headY = [[0, 0]];
    for (let i = 0; i < n; i++) {
      const t = g0 + i * P, left = i % 2 === 0;
      // the lifted (heel-up) foot switches fast; the other slides flat
      (left ? legL : legR).push([t, 1, 'snap'], [t + 0.08, 0.88, 'hold']);
      (left ? legR : legL).push([t, 0.88, 'snap'], [t + 0.08, 1, 'hold']);
      armL.push([t, left ? 8 * A : -6 * A, 'inout']);
      armR.push([t, left ? 6 * A : -8 * A, 'inout']);
      headY.push([t + 0.04, 3, 'out'], [t + 0.2, 0, 'inout']);
    }
    legL.push([g1, 1, 'snap'], [toe, 1], [hold, 1], [end, 1]);
    legR.push([g1, 1, 'snap'], [toe, 1], [hold, 1], [end, 1]);
    const fling = -Math.min(D.armMax, 100);
    return {
      duration: end + 0.1,
      loop: false,
      travel: true,
      tracks: {
        root: {
          // constant glide (linear allowed for root.x travel), then up onto the toes
          x: [[0, -W * sgn], [g0, -W * sgn, 'linear'], [g1, W * sgn], [end, W * sgn]],
          y: [[0, 0], [g1, 0, 'snap'], [toe, -10, D.settle], [hold, -10, 'inout'], [end, 0]],
        },
        body: { ss: [[0, 1], [g1, 1, 'snap'], [toe, 1.05, D.settle], [hold, 1.05, 'inout'], [end, 1]] },
        torso: { r: [[0, 0, 'inout'], [g0, 3 * sgn, 'inout'], [g1, 3 * sgn, 'snap'], [toe, -2 * sgn, D.settle], [hold, -2 * sgn], [end, 0]] },
        leg_l: { sy: legL },
        leg_r: { sy: legR },
        arm_l: { r: armL.concat([[g1, 0, 'snap'], [end, 0]]) },
        arm_r: { r: armR.concat([[g1, 0, 'snap'], [toe, fling, D.settle], [hold, fling, D.main], [end, 0, D.settle]]) },
        fore_r: { r: [[0, 0], [g1, 0, 'snap'], [toe + D.lag, -40, D.settle], [hold, -40, D.main], [end, 0]] },
        head: { y: headY.concat([[g1, 0, 'snap'], [toe, -4, D.settle], [hold, -4], [end, 0]]), r: [[0, 0], [g1, 0, 'snap'], [toe, -8 * sgn, D.settle], [hold, -8 * sgn], [end, 0]] },
        pupils: { x: [[0, 0], [0.1, 0, 'snap'], [0.2, 6 * sgn], [g1, 6 * sgn, 'snap'], [g1 + 0.1, 0]] },
        eyes: { sy: [[0, 1], [g0, 0.75, 'inout'], [g1, 0.75, 'snap'], [toe, 0.5, 'out'], [hold, 0.5], [end, 1]] },
      },
      swaps: { mouth: [[0, 'smile'], [g0, 'flat'], [toe, 'o'], [hold, 'smile']] },
    };
  };
  M.moonwalk.burst = true;

  // ---------- peace (比耶): little hop, V sign beside the cheek, head tilts into it, happy squint ----------
  M.peace = (D, def) => {
    const T = (x) => x * D.tempo, L = D.lag;
    const dip = T(0.12), up = T(0.32), hold = T(1.5), back = T(1.85);
    const m = {
      duration: back + T(0.2),
      loop: false,
      tracks: {
        body: { ss: [[0, 1, 'snap'], [dip, 0.94, 'out'], [up, 1.04, D.settle], [T(0.55), 1, 'inout'], [back, 1]] },
        root: { y: [[0, 0], [dip, 0, 'out'], [T(0.26), -D.jumpH * 0.12, 'in'], [T(0.4), 0, D.settle], [back, 0]] },
        // hand beside the ear, forearm vertical, fingers up against the background
        // (on the cheek the V was skin on skin and disappeared)
        arm_r: { r: [[0, 0, 'snap'], [T(0.08), 6, 'snap'], [up, -28, D.settle], [hold, -28, D.main], [back, 0, D.settle]] },
        fore_r: { r: [[0, 0, 'snap'], [T(0.1) + L, 0, 'snap'], [up + L, 208, D.settle], [T(0.9), 208, 'inout'], [T(1.0), 202, 'inout'], [T(1.1), 208], [hold, 208, D.main], [back + L, 0, D.settle]] },
        head: { r: [[0, 0], [up, 0, 'snap'], [up + L + 0.1, 8, D.settle], [hold, 8, 'inout'], [back, 0]], y: [[0, 0], [up + L, -2, D.settle], [hold, -2], [back, 0]] },
        eyes: { sy: [[0, 1], [up, 1, 'snap'], [up + 0.1, 0.55, 'out'], [hold, 0.55, 'snap'], [hold + 0.15, 1]] },
        brow_l: { y: [[0, 0], [up, -6, D.settle], [hold, -6], [back, 0]] },
        brow_r: { y: [[0, 0], [up, -6, D.settle], [hold, -6], [back, 0]] },
      },
      swaps: { mouth: [[0, 'smile'], [up, 'grin'], [hold, 'smile']], gesture: [[0, 'none'], [T(0.28), 'peace'], [hold + T(0.15), 'none']] },
    };
    return freeHand(m, 'r', def);
  };
  M.peace.burst = true;

  // ---------- heart (比心): hands meet at the chest, a heart pops out (bouncy), beats once, floats up and fades ----------
  M.heart = (D) => {
    const T = (x) => x * D.tempo, L = D.lag;
    const meet = T(0.4), pop = T(0.45), fade = T(1.25), gone = T(1.7), back = T(2.05);
    const armL = [[0, 0, 'snap'], [T(0.1), 4, 'snap'], [meet, -18, D.settle], [gone, -18, D.main], [back, 0, D.settle]];
    const foreL = [[0, 0, 'snap'], [T(0.14) + L, 0, 'snap'], [meet + L, -80, D.settle], [gone, -80, D.main], [back + L, 0, D.settle]];
    return {
      duration: back + T(0.2),
      loop: false,
      tracks: {
        arm_l: { r: armL },
        arm_r: { r: mirror(armL) },
        fore_l: { r: foreL },
        fore_r: { r: mirror(foreL) },
        body: { ss: [[0, 1], [meet, 1.03, 'inout'], [gone, 1.03, 'inout'], [back, 1]] },
        head: { r: [[0, 0], [meet, -6, 'inout'], [gone, -6, 'inout'], [back, 0]], y: [[0, 0], [meet, -2], [gone, -2], [back, 0]] },
        eyes: { sy: [[0, 1], [pop, 1, 'snap'], [pop + 0.1, 0.55, 'out'], [gone, 0.55, 'snap'], [gone + 0.15, 1]] },
        brow_l: { y: [[0, 0], [pop, -6, D.settle], [gone, -6], [back, 0]] },
        brow_r: { y: [[0, 0], [pop, -6, D.settle], [gone, -6], [back, 0]] },
        // the heart: pop with overshoot, one beat, float up, fade
        fx_heart: {
          sx: [[0, 0], [pop, 0, 'bouncy'], [T(0.75), 1.1, 'inout'], [T(0.9), 1.28, 'inout'], [T(1.02), 1.1, 'inout'], [gone, 0.85]],
          sy: [[0, 0], [pop, 0, 'bouncy'], [T(0.75), 1.1, 'inout'], [T(0.9), 1.28, 'inout'], [T(1.02), 1.1, 'inout'], [gone, 0.85]],
          y: [[0, 0], [pop, 0, 'out'], [gone, -55]],
          o: [[0, 1], [fade, 1, 'in'], [gone, 0]],
        },
      },
      swaps: { mouth: [[0, 'smile'], [pop, 'grin'], [gone, 'smile']], fx_heart: [[0, 'off'], [pop, 'on'], [gone, 'off']] },
    };
  };
  M.heart.burst = true;

  // ---------- faint (晕倒): dizzy → knees buckle → topple → JELLY impact (flatten, rebound, two smaller bounces,
  //            head smacks down a beat late) → stars knocked loose and scattered on the floor, brows knocked askew →
  //            lie there, a leg twitches → spring back up and shake it off ----------
  // The body rotates about the feet; while it tips, root.x/y move so the body lands inside the frame, lying ON the floor.
  // While lying, body.ss > 1 = flattened against the floor (ss scales along the body's length, which is now horizontal).
  M.faint = (D, def) => {
    const s = Math.sqrt(D.tempo);
    const dz = 1.2 * s, buckle = dz + 0.25, land = buckle + 0.38 * s;
    const b1 = land + 0.1, b2 = land + 0.22, b3 = land + 0.32, b4 = land + 0.42, rest = land + 0.6;
    const twitch = rest + 0.6, upT = twitch + 0.7, up = upT + 0.32, end = up + 0.75;
    const fall = -85, LIE = -38;
    // taller bodies (giraffe) land further right so the head stays in frame; 372 = standard height → unchanged
    const HT = (def && def.height) || 372, X0 = 150 + Math.max(0, HT - 372) * 0.9, SHX = -185 - (HT - 372) / 2;
    const circle = (r, period, until, phase = 0) => {
      const k = [[0, 0]];
      for (let t = 0.1, i = 0; t < until; t += period / 4, i++) k.push([t, +(r * Math.cos(phase + (i * Math.PI) / 2)).toFixed(2), 'inout']);
      return k;
    };
    const tracks = {
      body: {
        // tip over (gravity: 'in'), bounce twice off the floor, each smaller
        r: [[0, 0], [dz, 0, 'inout'], [buckle, 4, 'in'], [land, fall, 'out'], [b1, fall + 9, 'in'], [b2, fall, 'out'], [b3, fall + 3, 'in'], [b4, fall],
          [upT, fall, 'snap'], [up, 0, 'bouncy'], [end, 0]],
        // jelly: flatten on impact (held 2 frames), rebound thin, wobble out
        ss: [[0, 0.98], [dz, 0.98, 'out'], [buckle, 0.88, 'in'], [land - 0.06, 0.96, 'snap'], [land, 1.22, 'hold'], [land + 0.066, 1.22, 'out'],
          [b1, 0.9, 'inout'], [b2, 1.1, 'inout'], [b3, 0.96, 'inout'], [b4, 1.04, 'inout'], [rest, 1],
          [upT, 1, 'snap'], [upT + 0.1, 0.9, 'out'], [up, 1.1, D.settle], [up + 0.3, 1]],
      },
      root: {
        x: [[0, 0], [buckle, 0, 'in'], [land, X0], [upT, X0, 'snap'], [up, 0, 'out'], [end, 0]],
        // lying height: torso side on the floor (−66 left it hovering ~30px with the arm through the floor)
        y: [[0, 0], [buckle, 0, 'in'], [land, LIE, 'out'], [b1, LIE - 18, 'in'], [b2, LIE, 'out'], [b3, LIE - 6, 'in'], [b4, LIE], [upT, LIE, 'snap'], [up, 0, 'out'], [end, 0]],
      },
      head: {
        // the head lags the body and smacks down a beat later, then lolls
        r: circle(8, 0.5, dz).concat([[buckle, 0, 'in'], [land, -10], [land + 0.05, -10, 'in'], [b1 + 0.03, 9, D.settle], [rest, 5], [upT, 5],
          [up + 0.08, -12, 'inout'], [up + 0.22, 11, 'inout'], [up + 0.36, -7, 'inout'], [up + 0.5, 3, 'inout'], [end, 0]]),
        y: circle(4, 0.5, dz, Math.PI / 2).concat([[buckle, 0], [end, 0]]),
        ss: [[0, 1], [land, 1, 'snap'], [b1 + 0.03, 0.86, 'out'], [b2 + 0.05, 1.08, 'inout'], [b3 + 0.05, 0.97, 'inout'], [rest, 1], [end, 1]],
      },
      torso: { r: circle(4, 0.6, dz).concat([[buckle, 0], [end, 0]]) },
      pupils: {
        x: circle(6, 0.4, dz).concat([[buckle, 0], [end, 0]]),
        y: circle(6, 0.4, dz, Math.PI / 2).concat([[buckle, 0], [end, 0]]),
      },
      eyes: { sy: [[0, 0.85], [buckle, 0.85, 'snap'], [buckle + 0.1, 0.1, 'hold'], [upT, 0.1, 'snap'], [upT + 0.15, 1.3, 'out'], [up + 0.45, 1], [end, 1]] },
      // brows: worried while dizzy, KNOCKED ASKEW on impact (one up, one slanted down), stay crooked, snap back on waking
      brow_l: {
        r: [[0, -10], [buckle, -10], [land, -10, 'snap'], [land + 0.05, 22, 'overshoot'], [upT, 18, 'snap'], [upT + 0.15, 0, D.settle], [end, 0]],
        y: [[0, -3], [buckle, -3], [land, -3, 'snap'], [land + 0.05, 6, 'overshoot'], [upT, 5, 'snap'], [upT + 0.15, -6, D.settle], [up + 0.3, 0], [end, 0]],
      },
      brow_r: {
        r: [[0, 10], [buckle, 10], [land, 10, 'snap'], [land + 0.05, -4, 'overshoot'], [upT, -4, 'snap'], [upT + 0.15, 0, D.settle], [end, 0]],
        y: [[0, -3], [buckle, -3], [land, -3, 'snap'], [land + 0.05, -12, 'overshoot'], [upT, -10, 'snap'], [upT + 0.15, -6, D.settle], [up + 0.3, 0], [end, 0]],
      },
      // lying on its left side: the bottom arm (arm_l) bounces UP off the floor and lies flat along the body;
      // the top arm (arm_r) flies up on impact, then flops over the chest. Nothing goes through the floor.
      arm_l: { r: [[0, 0], [buckle, -6, 'out'], [land, -10, 'snap'], [b1 + 0.02, -38, 'out'], [b2, -8, 'in'], [rest, -4, 'out'], [upT, -4, 'snap'], [up, 0, D.settle], [end, 0]] },
      arm_r: { r: [[0, 0], [buckle, 6, 'out'], [land, -40, 'snap'], [b1 + 0.02, -85, 'out'], [b2, -20, 'in'], [rest, 28, 'out'], [upT, 28, 'snap'], [up, 0, D.settle], [end, 0]] },
      // legs kick up on impact and drop; one twitches later
      leg_l: { r: [[0, 0], [land, 0, 'snap'], [b1, -6, 'out'], [b2, 0, 'in'], [end, 0]] },
      leg_r: { sy: [[0, 1], [dz, 1, 'out'], [buckle, 0.9, 'in'], [land, 1], [end, 1]],
        r: [[0, 0], [land + 0.03, 0, 'snap'], [b1 + 0.03, -16, 'out'], [b2 + 0.03, 0, 'in'], [twitch, 0, 'snap'], [twitch + 0.08, -18, 'out'], [twitch + 0.25, 0], [end, 0]] },
      // shadow stretches under the whole lying body
      shadow: { x: [[0, 0], [buckle, 0, 'in'], [land, SHX], [upT, SHX, 'snap'], [up, 0, 'out'], [end, 0]], sx: [[0, 1], [buckle, 1, 'in'], [land, 2.6 * HT / 372], [upT, 2.6 * HT / 372, 'snap'], [up, 1, 'out'], [end, 1]] },
    };

    // stars: the ring spins (constant rate) until impact, then holds; each star is thrown in a world-space arc,
    // bounces once on the floor and comes to rest; they fade as he gets up.
    const spin = 300; // deg/s
    const ringAt = spin * land;
    tracks.fx_stars = {
      r: [[0, 0, 'linear'], [land, ringAt], [upT, ringAt]],
      sx: [[0, 0], [0.1, 0, 'bouncy'], [0.4, 1], [end, 1]],
      sy: [[0, 0], [0.1, 0, 'bouncy'], [0.4, 1], [end, 1]],
    };
    // rotation of the ring's frame at impact (body + head + ring): convert world motion into ring-local motion
    const theta = ((fall - 10 + ringAt) * Math.PI) / 180;
    const toLocal = (wx, wy) => [wx * Math.cos(-theta) - wy * Math.sin(-theta), wx * Math.sin(-theta) + wy * Math.cos(-theta)];
    const ringWorldY = -105 + (LIE + 66); // ring centre above the floor at impact (head end of the lying body)
    const G = 1600, DT = 1 / 30;
    IPM.STARS.forEach(([cx, cy], i) => {
      // star's height above the floor at impact
      const px = cx, py = cy; // offsets from the ring centre
      const wy0 = ringWorldY + (px * Math.sin(theta) + py * Math.cos(theta));
      // thrown up and to the right: the head lies near the left edge of the frame
      const vel = [[70, -360], [190, -250], [-30, -300]][i];
      let x = 0, y = wy0, vx = vel[0], vy = vel[1], bounced = false, rot = 0;
      const kx = [[0, 0], [land, 0, 'linear']], ky = [[0, 0], [land, 0, 'linear']], kr = [[0, 0], [land, 0, 'linear']];
      for (let t = DT; t <= 1.0 + 1e-6; t += DT) {
        vy += G * DT;
        x += vx * DT;
        y += vy * DT;
        rot += Math.sign(vx || 1) * Math.abs(vx) * 2 * DT;
        if (y > -6) {
          // floor (star radius above it): bounce once, then rest
          y = -6;
          if (!bounced) { vy = -vy * 0.35; vx *= 0.55; bounced = true; } else { vy = 0; vx *= 0.6; }
        }
        const [lx, ly] = toLocal(x, y - wy0);
        kx.push([land + t, +lx.toFixed(2), 'linear']);
        ky.push([land + t, +ly.toFixed(2), 'linear']);
        kr.push([land + t, +rot.toFixed(1), 'linear']);
      }
      const last = (k) => k[k.length - 1][1];
      kx.push([upT, last(kx)]);
      ky.push([upT, last(ky)]);
      kr.push([upT, last(kr)]);
      tracks['fx_star' + i] = { x: kx, y: ky, r: kr, o: [[0, 1], [upT - 0.2, 1, 'in'], [upT, 0]] };
    });

    const m = {
      duration: end + 0.1,
      loop: false,
      tracks,
      swaps: {
        mouth: [[0, 'wide'], [0.3, 'o'], [0.6, 'wide'], [0.9, 'o'], [buckle, 'open'], [land, 'wide'], [b2, 'open'], [upT, 'o'], [up + 0.4, 'flat'], [end - 0.1, 'smile']],
        fx_stars: [[0, 'off'], [0.1, 'on'], [upT, 'off']],
      },
    };
    // dust where the body hits (around its middle, ~185px from the feet), a smaller puff on the first bounce; shake the picture
    addDust(m, [{ t: land, x: X0 + SHX, s: 1.4 }, { t: b2, x: X0 + SHX, s: 0.7 }]);
    addShake(m, land, 7);
    return m;
  };

  M.hero.burst = true;
  M.dance.burst = true;
  M.floss.burst = true;
  M.dab.burst = true;

  M.happy_jump.burst = true;
  M.cheer.burst = true;

  // ---------- pose_test: QA only, holds extreme poses to check gaps and layering ----------
  M.pose_test = (D) => {
    const step = (vals) => {
      const keys = [];
      vals.forEach((v, i) => { keys.push([i * 0.6, v, 'hold'], [i * 0.6 + 0.35, v, 'snap']); });
      keys.push([4.2, vals[0]]); // close the loop (lint: loop-seam)
      return keys;
    };
    // neutral, arms max up, arms crossed in, forearms max bend, squash, stretch, head tilt
    return {
      duration: 4.2,
      loop: true,
      tracks: {
        arm_l: { r: step([0, D.armMax, -40, 30, 0, 0, 0]) },
        arm_r: { r: step([0, -D.armMax, 40, -30, 0, 0, 0]) },
        fore_l: { r: step([0, 0, 0, -140, 0, 0, 0]) },
        fore_r: { r: step([0, 0, 0, 140, 0, 0, 0]) },
        body: { ss: step([1, 1, 1, 1, 0.8, 1.14, 1]) },
        head: { r: step([0, 0, 0, 0, 0, 0, 12]) },
      },
      swaps: { mouth: [[0, 'smile'], [0.6, 'grin'], [1.2, 'o'], [1.8, 'wide'], [2.4, 'sad'], [3.0, 'open'], [3.6, 'u']] },
    };
  };

  // =====================================================================================================
  // Game juice (references/game-juice.md): tap reactions, invitation to tap, a tap-to-FEVER crescendo
  // =====================================================================================================
  // every prop any tap variant touches; a tap that doesn't use one eases it back to neutral
  const TAP_PROPS = [['body', 'ss', 1], ['body', 'r', 0], ['head', 'y', 0], ['head', 'r', 0], ['eyes', 'sy', 1],
    ['root', 'y', 0], ['arm_l', 'r', 0], ['arm_r', 'r', 0]];

  // one tap reaction starting at t0. s = intensity (1..1.6), sp = speed (1..1.8).
  // No anticipation: frame 0 is already the extreme pose; any frame can be interrupted by the next tap.
  function tapKeys(variant, t0, s, sp) {
    const T = (dt) => +(t0 + dt / sp).toFixed(4);
    const tr = {}, mouth = [];
    const put = (part, prop, keys) => { (tr[part] = tr[part] || {})[prop] = keys; };
    if (variant === 1) { // squish: flattened, eyes squeezed, pops back
      put('body', 'ss', [[T(0), 1, 'snap'], [T(0.001), 1 - 0.13 * s, 'out'], [T(0.12), 1 + 0.06 * s, 'inout'], [T(0.24), 0.98, 'inout'], [T(0.34), 1]]);
      put('head', 'y', [[T(0), 0, 'snap'], [T(0.001), 8 * s, 'out'], [T(0.15), -4, 'inout'], [T(0.3), 0]]);
      put('eyes', 'sy', [[T(0), 1, 'snap'], [T(0.001), 0.15, 'hold'], [T(0.09), 0.15, 'out'], [T(0.2), 1]]);
      mouth.push([T(0), 'o'], [T(0.12), 'grin']);
    } else if (variant === 2) { // wobble: body twists side to side, arms fling out
      put('body', 'r', [[T(0), 0, 'snap'], [T(0.001), -11 * s, 'out'], [T(0.12), 8 * s, 'inout'], [T(0.22), -4, 'inout'], [T(0.34), 0]]);
      put('arm_l', 'r', [[T(0), 0, 'snap'], [T(0.001), 45 * s, 'out'], [T(0.32), 0]]);
      put('arm_r', 'r', [[T(0), 0, 'snap'], [T(0.001), -45 * s, 'out'], [T(0.32), 0]]);
      put('eyes', 'sy', [[T(0), 1, 'snap'], [T(0.001), 0.6, 'out'], [T(0.3), 1]]);
      mouth.push([T(0), 'grin']);
    } else if (variant === 3) { // boing: a little hop
      put('root', 'y', [[T(0), 0, 'out'], [T(0.13), -38 * s, 'in'], [T(0.26), 0]]);
      put('body', 'ss', [[T(0), 1, 'snap'], [T(0.001), 0.88, 'out'], [T(0.06), 1 + 0.08 * s, 'out'], [T(0.13), 1, 'in'], [T(0.26), 0.92, 'out'], [T(0.38), 1]]);
      put('arm_l', 'r', [[T(0), 0], [T(0.06), 60 * s, 'out'], [T(0.26), 20, 'out'], [T(0.4), 0]]);
      put('arm_r', 'r', [[T(0), 0], [T(0.06), -60 * s, 'out'], [T(0.26), -20, 'out'], [T(0.4), 0]]);
      mouth.push([T(0), 'grin']);
    } else { // giggle: fast head shake, squinting, mouth flickers
      const shake = [[T(0), 0, 'snap']];
      for (let i = 0; i < 6; i++) shake.push([T(0.025 + i * 0.05), (i % 2 ? -6 : 6) * s, 'inout']);
      shake.push([T(0.34), 0]);
      put('head', 'r', shake);
      put('body', 'ss', [[T(0), 1, 'snap'], [T(0.001), 0.95, 'out'], [T(0.3), 1]]);
      put('eyes', 'sy', [[T(0), 1, 'snap'], [T(0.001), 0.5, 'hold'], [T(0.28), 0.5, 'out'], [T(0.36), 1]]);
      for (let i = 0; i < 5; i++) mouth.push([T(i * 0.06), i % 2 ? 'wide' : 'grin']);
    }
    for (const [part, prop, v] of TAP_PROPS) if (!(tr[part] && tr[part][prop])) put(part, prop, [[T(0.08), v, 'snap']]);
    return { tr, mouth };
  }

  // the layered feedback of one tap; k = combo level 0..1
  function tapFx(t, k, value, seed, x = 0) {
    const ev = [
      { t, type: 'coin', n: 3 + Math.round(7 * k), x, y: -200, dir: -90, spread: 150, speed: [280, 470], life: 0.85, seed },
      { t, type: 'spark', n: 8, x, y: -220, dir: 0, spread: 360, speed: [300, 520], gravity: 0, life: 0.25, seed: seed + 1, color: '#FFE38A' },
      // numbers pop above the head, spread ±80px so fast taps don't stack on one spot
      { t, type: 'text', x: x + ((seed * 37) % 160) - 80, y: -390, label: '+' + value, size: 1 + 0.6 * k, color: k >= 0.99 ? '#FFB020' : '#FF8A3D', life: 0.75, seed: seed + 2 },
    ];
    if (k > 0.25) ev.push({ t, type: 'ring', x, y: -200, life: 0.3, size: 1 + 0.6 * k, seed: seed + 3 });
    if (k > 0.4) ev.push({ t, type: 'star', n: 2 + Math.round(3 * k), x, y: -260, dir: -90, spread: 200, speed: [240, 400], life: 0.8, seed: seed + 4 });
    if (k > 0.6) ev.push({ t, type: 'heart', n: 2, x, y: -260, dir: -90, spread: 160, speed: [200, 320], gravity: 500, life: 0.9, seed: seed + 5 });
    if (k > 0.6) ev.push({ t, type: 'lines', n: 10, x, y: -200, dir: 0, spread: 360, life: 0.3, seed: seed + 6 });
    return ev;
  }
  IPM.juice = { tapKeys, tapFx, TAP_PROPS };

  const mergeTap = (m, r) => {
    for (const part in r.tr) for (const prop in r.tr[part]) addKeys(m, part, prop, r.tr[part][prop]);
    m.swaps.mouth.push(...r.mouth);
  };

  // ---------- tap@1..4: one tap reaction with its full feedback stack ----------
  M.tap = (D, def, arg) => {
    // tap@2 → variant 2 with its own feedback; tap@2q → quiet (the playground spawns feedback at the pointer itself)
    const v = (((parseInt(arg, 10) || 1) - 1) % 4) + 1, t0 = 0.05, quiet = /q/.test(arg || '');
    const m = { duration: 0.55, loop: false, tracks: {}, swaps: { mouth: [[0, 'smile']] }, fx: quiet ? [] : tapFx(t0, 0.2, 1, 11 * v) };
    for (const [part, prop, val] of TAP_PROPS) addKeys(m, part, prop, [[0, val]]);
    mergeTap(m, tapKeys(v, t0, 1.1, 1));
    m.swaps.mouth.push([0.45, 'smile']);
    return m;
  };
  M.tap.burst = true;

  // ---------- beckon: idle, then two little bounces toward the viewer, a wink and a twinkle — "tap me!" ----------
  M.beckon = (D, def) => {
    const m = M.idle(D, def);
    const t = 2.1;
    m.tracks.root = Object.assign({}, m.tracks.root, { y: [[0, 0], [t, 0, 'out'], [t + 0.1, -10, 'in'], [t + 0.2, 0, 'out'], [t + 0.3, -8, 'in'], [t + 0.4, 0], [4.8, 0]] });
    m.tracks.body.ss = [[0, 1, 'inout'], [t, 1, 'snap'], [t + 0.04, 0.94, 'out'], [t + 0.1, 1.04, 'in'], [t + 0.2, 0.95, 'out'], [t + 0.3, 1.03, 'in'], [t + 0.4, 0.97, D.settle], [t + 0.6, 1], [4.8, 1]];
    m.tracks.head.r = [[0, 0], [t, 0, 'snap'], [t + 0.15, 6, D.settle], [t + 0.9, 6, 'inout'], [t + 1.2, 0], [4.8, 0]];
    m.tracks.eyes.sy = [[0, 1], [t + 0.5, 1, 'in'], [t + 0.56, 0.1, 'hold'], [t + 0.75, 0.1, 'out'], [t + 0.85, 1], [4.8, 1]];
    m.fx = [{ t: t + 0.45, type: 'star', x: 82, y: -330, speed: [0, 0], gravity: 0, spread: 0, life: 0.5, size: 1.3, seed: 5 },
      { t: t + 0.45, type: 'spark', n: 6, x: 82, y: -330, dir: 0, spread: 360, speed: [120, 200], gravity: 0, life: 0.3, seed: 6 }];
    m.swaps = { mouth: [[0, 'smile'], [t, 'grin'], [t + 1.0, 'smile']] };
    return m;
  };

  // ---------- fever: rapid tapping that speeds up — combo grows, playback accelerates, feedback escalates — FEVER! ----------
  M.fever = (D, def) => {
    const m = { duration: 0, loop: false, tracks: {}, swaps: { mouth: [[0, 'smile']] }, fx: [] };
    for (const [part, prop, val] of TAP_PROPS) addKeys(m, part, prop, [[0, val]]);
    // tap times: 0.5s apart at first, 10% faster every tap, down to 0.11s
    const taps = [];
    for (let t = 0.3, dt = 0.5; taps.length < 26; t += dt, dt = Math.max(0.11, dt * 0.9)) taps.push(t);
    const r = rand(17);
    let last = 0;
    taps.forEach((t0, i) => {
      const k = Math.min(1, i / 25), sp = 1 + 0.8 * k, s = 1 + 0.6 * k;
      let v;
      do v = 1 + Math.floor(r() * 4); while (v === last);
      last = v;
      // interrupted by the next tap: drop keys at or after it
      const next = taps[i + 1] ?? Infinity, rt = tapKeys(v, t0, s, sp);
      for (const part in rt.tr) for (const prop in rt.tr[part]) rt.tr[part][prop] = rt.tr[part][prop].filter((key) => key[0] < next);
      rt.mouth = rt.mouth.filter((key) => key[0] < next);
      mergeTap(m, rt);
      const value = k < 0.2 ? 1 : k < 0.5 ? 2 : k < 0.85 ? 5 : 10;
      // the last tap leaves the stage to the FEVER title: no number of its own
      m.fx.push(...tapFx(t0, k, value, 100 + i * 9).filter((e) => !(i === taps.length - 1 && e.type === 'text')));
      addKeys(m, 'stage', 'sx', [[t0, 1, 'snap'], [t0 + 0.001, 1 + 0.03 * s, 'out'], [t0 + 0.12, 1]]);
      addKeys(m, 'stage', 'sy', [[t0, 1, 'snap'], [t0 + 0.001, 1 + 0.03 * s, 'out'], [t0 + 0.12, 1]]);
    });
    // FEVER: rays behind, confetti rain, big title, zoom punch, shake — and the character celebrates
    const tf = taps[taps.length - 1] + 0.12, A = Math.min(D.armMax, 125);
    m.fx.push({ t: tf, type: 'rays', x: 0, y: -220, speed: [0, 0], gravity: 0, life: 2.6, size: 1.2, seed: 901 },
      { t: tf, type: 'confetti', n: 70, x: 0, y: -620, dir: 90, spread: 70, speed: [60, 260], gravity: 420, life: 2.4, seed: 902, stagger: 0.012 },
      { t: tf, type: 'text', x: 0, y: -450, label: 'FEVER!', size: 1.9, color: '#FFB020', life: 1.4, seed: 903 },
      { t: tf, type: 'ring', x: 0, y: -200, life: 0.45, size: 2.4, seed: 904, color: '#FFD84D' });
    addKeys(m, 'stage', 'sx', [[tf, 1, 'snap'], [tf + 0.001, 1.08, 'out'], [tf + 0.3, 1]]);
    addKeys(m, 'stage', 'sy', [[tf, 1, 'snap'], [tf + 0.001, 1.08, 'out'], [tf + 0.3, 1]]);
    addShake(m, tf, 5);
    const cel = [['root', 'y', [[tf, 0, 'out'], [tf + 0.15, -46, 'in'], [tf + 0.3, 0, 'out'], [tf + 0.45, -30, 'in'], [tf + 0.6, 0]]],
      ['body', 'ss', [[tf, 1, 'snap'], [tf + 0.001, 0.86, 'out'], [tf + 0.08, 1.1, 'out'], [tf + 0.15, 1, 'in'], [tf + 0.3, 0.9, 'out'], [tf + 0.38, 1.06, 'in'], [tf + 0.45, 1, 'in'], [tf + 0.6, 0.92, D.settle], [tf + 0.9, 1]]],
      ['arm_l', 'r', [[tf, 0, 'snap'], [tf + 0.12, A, D.settle], [tf + 1.6, A - 6, D.main], [tf + 2.0, 0, D.settle]]],
      ['arm_r', 'r', [[tf, 0, 'snap'], [tf + 0.12, -A, D.settle], [tf + 1.6, -A + 6, D.main], [tf + 2.0, 0, D.settle]]],
      ['eyes', 'sy', [[tf, 1, 'snap'], [tf + 0.08, 0.5, 'out'], [tf + 1.8, 0.5, 'out'], [tf + 2.0, 1]]],
      ['head', 'r', [[tf, 0], [tf + 0.4, -5, 'inout'], [tf + 0.8, 5, 'inout'], [tf + 1.2, -4, 'inout'], [tf + 1.6, 0]]]];
    for (const [part, prop, keys] of cel) addKeys(m, part, prop, keys);
    m.swaps.mouth.push([tf, 'grin'], [tf + 2.0, 'smile']);
    m.duration = tf + 2.4;
    return m;
  };
  M.fever.burst = true;

  // ---------- impact pass: dust under every landing (bigger for heavier characters) ----------
  const withImpacts = (name, events) => {
    const tpl = M[name];
    M[name] = Object.assign((D, def, arg) => addDust(tpl(D, def, arg), events(D)), { burst: tpl.burst });
  };
  const dustS = (D, k = 1) => k * (D.tiptoe ? 0.4 : 0.6 + 0.8 * D.weight);
  withImpacts('happy_jump', (D) => {
    const T = (x) => x * D.tempo, d = T(0.18) * (D.antic - 1);
    return [{ t: T(0.8) + d, s: dustS(D) }];
  });
  withImpacts('cheer', (D) => [{ t: 0.42 * D.tempo, s: dustS(D, 0.6) }, { t: 0.72 * D.tempo, s: dustS(D, 0.7) }]);
  withImpacts('shock', (D) => [{ t: 0.46 * D.tempo, s: dustS(D, 0.6) }]);
  withImpacts('hero', (D) => [{ t: 0.52 * D.tempo, s: dustS(D, 0.8) }]);
})();
