IPM.register('monkey', {
  name: '猴子',
  svg: 'characters/monkey/character.svg',
  profile: { weight: 0.25, energy: 0.95, stability: 0.8, style: 'bouncy' },
  handX: 82,
  springs: [
    // long floppy tail: low damping, swings with every hop and every hip turn
    { part: 'tail', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'torso', prop: 'r', w: 6 }, { part: 'root', prop: 'x', w: -1 }], k: 160, c: 4, gain: 1.8, max: 35 },
    { part: 'ear_l', prop: 'r', src: [{ part: 'root', prop: 'y', w: 0.6 }, { part: 'head', prop: 'r', w: 4 }], k: 280, c: 7, gain: 1, max: 12 },
    { part: 'ear_r', prop: 'r', src: [{ part: 'root', prop: 'y', w: -0.6 }, { part: 'head', prop: 'r', w: 4 }], k: 280, c: 7, gain: 1, max: 12 },
    { part: 'hair_tuft', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'body', prop: 'ss', w: -300 }], k: 320, c: 7, gain: 2.4, max: 35 },
  ],
});
