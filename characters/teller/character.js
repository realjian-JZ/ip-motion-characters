IPM.register('teller', {
  name: '银行职员',
  svg: 'characters/teller/character.svg',
  profile: { weight: 0.5, energy: 0.6, stability: 1, style: 'steady' },
  extras: ['alert'],
  springs: [
    // scarf tails splay apart on vertical moves and trail torso turns
    { part: 'scarf_l', prop: 'r', src: [{ part: 'root', prop: 'y', w: 0.8 }, { part: 'torso', prop: 'r', w: 6 }, { part: 'root', prop: 'x', w: -1 }], k: 240, c: 5.5, gain: 1.6, max: 25 },
    { part: 'scarf_r', prop: 'r', src: [{ part: 'root', prop: 'y', w: -0.8 }, { part: 'torso', prop: 'r', w: 6 }, { part: 'root', prop: 'x', w: -1 }], k: 240, c: 5.5, gain: 1.6, max: 25 },
    // the bob's side lock bounces a little
    { part: 'hair_tuft', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'head', prop: 'r', w: 6 }], k: 280, c: 7, gain: 1.2, max: 15 },
  ],
});
