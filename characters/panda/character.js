IPM.register('panda', {
  name: '熊猫',
  svg: 'characters/panda/character.svg',
  // heavy and lazy most of the time, but happy moves use a big burst — the contrast is the joke
  profile: { weight: 0.75, energy: 0.45, burst: 0.75, stability: 0.95, style: 'tired', armMax: 110 },
  hair: 'ear_r', // what stands up when shocked
  handX: 88,
  springs: [
    { part: 'ear_l', prop: 'r', src: [{ part: 'root', prop: 'y', w: 0.8 }, { part: 'head', prop: 'r', w: 5 }], k: 260, c: 7, gain: 1.2, max: 15 },
    { part: 'ear_r', prop: 'r', src: [{ part: 'root', prop: 'y', w: -0.8 }, { part: 'head', prop: 'r', w: 5 }], k: 260, c: 7, gain: 1.2, max: 15 },
  ],
});
