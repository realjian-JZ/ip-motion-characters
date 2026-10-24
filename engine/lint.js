/* Motion lint: checks the hard rules numerically on every character × motion, before anything is rendered.
 * Run through scripts/lint.py (headless Chrome). Each issue: { sev: 'error'|'warn', char, motion, rule, detail }. */
(function () {
  const BODY = ['root', 'body', 'torso', 'head', 'arm_l', 'arm_r', 'fore_l', 'fore_r'];
  const TOL = { r: 6, x: 3, y: 3, ss: 0.02 };

  IPM.lint = async () => {
    const issues = [];
    const EASES = new Set(Object.keys(IPM.EASE).concat(['hold']));
    for (const cid in IPM.characters) {
      const rig = await IPM.mount(document.createElement('div'), cid);
      const def = rig.def, D = rig.D;
      const names = ['idle', 'idle@1', 'idle@2', 'happy_jump', 'cheer', 'sad', 'think', 'talk', 'shock', 'phone_look',
        'walk', 'walk_across', 'walk_across@l', 'dance', 'floss', 'dab', 'hero',
        'robot', 'moonwalk', 'moonwalk@r', 'peace', 'heart', 'faint',
        'tap@1', 'tap@2', 'tap@3', 'tap@4', 'beckon', 'fever',
        ...(def.extras || []), ...Object.keys(IPM.cues).map((c) => 'speak@' + c), 'pose_test'];
      const idle = rig.motion('idle');
      const at = (m, part, prop, t) => {
        const k = m.tracks[part] && m.tracks[part][prop];
        return k ? IPM.evalKeys(k, t) : IPM.DEFAULTS[prop];
      };
      for (const n of names) {
        const add = (sev, rule, detail) => issues.push({ sev, char: cid, motion: n, rule, detail });
        let m;
        try {
          m = rig.motion(n);
        } catch (e) {
          add('error', 'build', e.message);
          continue;
        }
        for (const part in m.tracks) {
          if (!rig.parts[part]) add('warn', 'unknown-part', `${part} has keys but the character has no such part`);
          for (const prop in m.tracks[part]) {
            const keys = m.tracks[part][prop];
            keys.forEach((k, i) => {
              const where = `${part}.${prop} @${(+k[0]).toFixed(2)}s`;
              if (!isFinite(k[0]) || !isFinite(k[1])) add('error', 'nan', where);
              if (k[0] < -1e-6 || k[0] > m.duration + 1e-6) add('warn', 'key-outside-clip', `${where} (clip ${m.duration.toFixed(2)}s)`);
              if (k[2] && !EASES.has(k[2])) add('error', 'bad-ease', `${where}: "${k[2]}"`);
              // linear allowed only for root.x travel (constant walking speed) and fx_* effects (constant spin)
              if (k[2] === 'linear' && i + 1 < keys.length && keys[i + 1][1] !== k[1] && !(part === 'root' && prop === 'x') && !part.startsWith('fx_')) add('error', 'linear', where);
            });
            if (m.loop) {
              const a = IPM.evalKeys(keys, 0), b = IPM.evalKeys(keys, m.duration);
              if (Math.abs(a - b) > 1e-4) add('error', 'loop-seam', `${part}.${prop}: ${a.toFixed(3)} → ${b.toFixed(3)}`);
            }
          }
        }
        // raised arms stay under armMax (arm_l positive, arm_r negative)
        const lim = D.armMax + 2;
        const armL = m.tracks.arm_l && m.tracks.arm_l.r, armR = m.tracks.arm_r && m.tracks.arm_r.r;
        if (armL && Math.max(...armL.map((k) => k[1])) > lim) add('error', 'arm-max', `arm_l ${Math.max(...armL.map((k) => k[1])).toFixed(0)}° > ${D.armMax}°`);
        if (armR && Math.min(...armR.map((k) => k[1])) < -lim) add('error', 'arm-max', `arm_r ${Math.min(...armR.map((k) => k[1])).toFixed(0)}° < -${D.armMax}°`);
        // one-shots end where idle starts, so any motion can hand back to idle
        if (!m.loop && n !== 'pose_test') {
          for (const part of BODY) {
            if (!rig.parts[part]) continue;
            for (const prop in TOL) {
              if (m.travel && part === 'root' && prop === 'x') continue; // locomotion ends somewhere else on purpose
              const e = at(m, part, prop, m.duration), s = at(idle, part, prop, 0);
              if (Math.abs(e - s) > TOL[prop]) add('warn', 'end-pose', `${part}.${prop} ends ${e.toFixed(2)}, idle starts ${s.toFixed(2)}`);
            }
          }
        }
        // every swap name must exist on the character (directly or via swapAlias)
        for (const g in m.swaps || {}) {
          const grp = rig.groups[g];
          if (!grp) continue;
          for (const [, v] of m.swaps[g]) {
            const name = (def.swapAlias || {})[v] || v;
            if (v != null && !grp.items[name]) add('warn', 'missing-swap', `${g}: "${v}"`);
          }
        }
      }
    }
    return issues;
  };
})();
