IPM.register('giraffe', {
  name: '长颈鹿',
  svg: 'characters/giraffe/character.svg',
  // graceful and unhurried; stability 1, so 'slow' without the tremble
  profile: { weight: 0.5, energy: 0.55, stability: 1, style: 'slow' },
  hair: 'horns',
  handX: 74,
  starsY: -520, // the head sits on a neck, 92px higher than a standard head
  height: 480, // for faint: lands further right so the head stays in frame
  chinReach: false, // think: hoof on the chest, the chin is out of reach
  noFingers: true, // hooves: no V sign
  springs: [
    { part: 'horns', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'head', prop: 'r', w: 6 }], k: 300, c: 8, gain: 1.2, max: 14 },
    { part: 'ear_l', prop: 'r', src: [{ part: 'root', prop: 'y', w: 0.7 }, { part: 'head', prop: 'r', w: 5 }], k: 260, c: 6, gain: 1.2, max: 18 },
    { part: 'ear_r', prop: 'r', src: [{ part: 'root', prop: 'y', w: -0.7 }, { part: 'head', prop: 'r', w: 5 }], k: 260, c: 6, gain: 1.2, max: 18 },
    { part: 'tail', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'torso', prop: 'r', w: 6 }, { part: 'root', prop: 'x', w: -1 }], k: 200, c: 5, gain: 1.6, max: 30 },
  ],
});
