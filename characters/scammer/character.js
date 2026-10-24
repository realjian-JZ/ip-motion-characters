IPM.register('scammer', {
  name: '骗子',
  svg: 'characters/scammer/character.svg',
  profile: { weight: 0.4, energy: 0.75, stability: 0.7, style: 'sly' },
  // his "smile" is always a lopsided smirk
  swapAlias: { smile: 'smirk' },
  extras: ['sneaky'],
  hair: 'hair_lock', // his spiky bit is the forelock, not a crown tuft
  springs: [
    // greasy forelock: swings with the head turn and bounces on vertical moves
    { part: 'hair_lock', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'head', prop: 'r', w: 8 }], k: 300, c: 6, gain: 2.2, max: 30 },
  ],
});
