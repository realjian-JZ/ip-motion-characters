IPM.register('penguin', {
  name: '企鹅',
  svg: 'characters/penguin/character.svg',
  // its own style: quick tiny steps and a big side-to-side rock ('slow' read the same as the panda and giraffe)
  profile: { weight: 0.45, energy: 0.6, stability: 0.9, style: 'waddle' },
  handX: 98, // the 'hand' is the flipper tip
  noFingers: true, // peace = flipper raised by the face, no fingers drawn
  springs: [
    { part: 'hair_tuft', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'body', prop: 'ss', w: -300 }], k: 300, c: 6, gain: 2.4, max: 35 },
  ],
});
