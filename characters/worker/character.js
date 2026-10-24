IPM.register('worker', {
  name: '上班族',
  svg: 'characters/worker/character.svg',
  // tired by default; happy/cheer use `burst` — the contrast is the character
  profile: { weight: 0.5, energy: 0.4, burst: 0.85, stability: 0.85, style: 'tired' },
  upright: ['case'],
  busyHand: 'l', // briefcase in the left hand
  extras: ['yawn'],
  springs: [
    { part: 'tie', prop: 'r', src: [{ part: 'root', prop: 'y', w: 0.8 }, { part: 'torso', prop: 'r', w: 6 }, { part: 'root', prop: 'x', w: -1 }], k: 220, c: 5, gain: 1.8, max: 30 },
    { part: 'badge', prop: 'r', src: [{ part: 'root', prop: 'y', w: -0.8 }, { part: 'torso', prop: 'r', w: 6 }], k: 180, c: 4.5, gain: 1.6, max: 30 },
    { part: 'case', prop: 'r', src: [{ part: 'root', prop: 'y', w: -0.5 }, { part: 'arm_l', prop: 'r', w: 2 }, { part: 'fore_l', prop: 'r', w: 2 }], k: 110, c: 9.5, gain: 1.3, max: 30 },
    { part: 'hair_tuft', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'body', prop: 'ss', w: -300 }], k: 300, c: 6, gain: 2.4, max: 35 },
  ],
});
