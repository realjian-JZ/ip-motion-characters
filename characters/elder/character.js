IPM.register('elder', {
  name: '老年人',
  svg: 'characters/elder/character.svg',
  // armMax: older shoulders don't go far past horizontal
  profile: { weight: 0.55, energy: 0.25, stability: 0.45, style: 'slow', armMax: 100 },
  upright: ['bag'],
  busyHand: 'r', // right hand holds the bag: one-hand gestures use the left
  springs: [
    // handbag swings like a pendulum: driven by sideways/vertical moves and by the arm swinging
    { part: 'bag', prop: 'r', src: [{ part: 'root', prop: 'y', w: 0.6 }, { part: 'arm_r', prop: 'r', w: 2 }, { part: 'fore_r', prop: 'r', w: 2 }, { part: 'root', prop: 'x', w: -1 }], k: 120, c: 9.5, gain: 1.4, max: 35 },
    // the comb-over strand lifts a little on any bounce
    { part: 'hair_tuft', prop: 'r', src: [{ part: 'root', prop: 'y' }, { part: 'body', prop: 'ss', w: -300 }], k: 260, c: 8, gain: 1.2, max: 15 },
  ],
});
