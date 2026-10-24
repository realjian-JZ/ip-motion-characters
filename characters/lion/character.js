IPM.register('lion', {
  name: '狮子',
  svg: 'characters/lion/character.svg',
  // proud and steady, with a big burst when it lets go
  profile: { weight: 0.6, energy: 0.7, burst: 0.9, stability: 1, style: 'steady' },
  hair: 'mane_tuft',
  springs: [
    // the mane is a big soft mass: it squashes on landings and lags head turns
    { part: 'mane', prop: 'ss', src: [{ part: 'root', prop: 'y' }], k: 260, c: 6, gain: -0.0025, max: 0.08 },
    { part: 'mane', prop: 'r', src: [{ part: 'head', prop: 'r', w: 4 }, { part: 'root', prop: 'x', w: -1 }], k: 220, c: 6, gain: 0.6, max: 8 },
    { part: 'mane_tuft', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'body', prop: 'ss', w: -300 }], k: 300, c: 6, gain: 2, max: 30 },
    { part: 'tail', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'torso', prop: 'r', w: 6 }, { part: 'root', prop: 'x', w: -1 }], k: 180, c: 4.5, gain: 1.8, max: 30 },
  ],
});
