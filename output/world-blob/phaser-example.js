// preload
this.load.spritesheet('blob-down', 'blob-down-spritesheet.png', {
  frameWidth: 256, frameHeight: 256
});

// create
this.anims.create({
  key: 'blob-walk-down',
  frames: this.anims.generateFrameNumbers('blob-down', { start: 0, end: 23 }),
  frameRate: 12,
  repeat: -1
});
const blob = this.add.sprite(x, y, 'blob-down')
  .setOrigin(0.5, 0.9652777778)
  .setTint(0x6486ff)
  .play('blob-walk-down');
