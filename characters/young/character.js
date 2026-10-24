IPM.register('young', {
  name: '年轻人',
  svg: 'characters/young/character.svg',
  profile: { weight: 0.3, energy: 0.95, stability: 0.9, style: 'bouncy' },
  springs: [
    // tuft flicks back on take-off and wobbles after landing
    { part: 'hair_tuft', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'body', prop: 'ss', w: -300 }], k: 320, c: 7, gain: 2.6, max: 35 },
    // hoodie strings splay outward on vertical moves and swing with the torso
    { part: 'strings_l', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'torso', prop: 'r', w: 6 }], k: 260, c: 6, gain: 1.6, max: 28 },
    { part: 'strings_r', prop: 'r', src: [{ part: 'root', prop: 'y', w: -1 }, { part: 'torso', prop: 'r', w: 6 }], k: 260, c: 6, gain: 1.6, max: 28 },
  ],
});
