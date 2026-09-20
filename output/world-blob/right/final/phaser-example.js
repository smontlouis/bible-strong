// preload
this.load.spritesheet('blob-right', 'blob-right-spritesheet.png', {
  frameWidth: 256, frameHeight: 256
});
// create
this.anims.create({
  key: 'blob-walk-right',
  frames: this.anims.generateFrameNumbers('blob-right', {start: 0, end: 23}),
  frameRate: 12, repeat: -1
});
const blob = this.add.sprite(x, y, 'blob-right')
  .setOrigin(0.5, 0.9732142857)
  .setTint(0x6486ff)
  .play('blob-walk-right');
// For leftward movement: blob.setFlipX(true);
