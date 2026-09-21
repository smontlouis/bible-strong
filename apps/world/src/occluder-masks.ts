import type Phaser from 'phaser'

// Reviewed timber outlines in each cutout's native (2×) pixel coordinates.
// The segmentation included the ground between the sign boards; these masks
// keep that ground from being painted over avatars passing behind the signs.
const signOutlines: Record<string, number[][]> = {
  'sign-west': [
    [29, 6, 33, 2, 38, 1, 44, 2, 49, 5, 50, 8, 50, 136, 46, 139, 34, 139, 29, 136],
    [5, 18, 30, 22, 30, 41, 5, 35, 3, 32, 3, 23],
    [44, 27, 77, 32, 82, 36, 84, 41, 82, 46, 79, 50, 44, 44, 41, 42, 42, 31],
    [4, 61, 33, 67, 36, 69, 36, 81, 5, 78, 1, 75, 1, 67],
    [44, 67, 78, 72, 82, 76, 81, 81, 78, 87, 75, 89, 44, 85, 41, 82, 42, 71],
  ],
  'sign-east': [
    [32, 5, 36, 1, 41, 0, 47, 1, 52, 4, 54, 7, 53, 125, 42, 132, 32, 131],
    [3, 37, 34, 28, 39, 29, 41, 33, 41, 45, 6, 55, 2, 53, 0, 49, 0, 42],
    [53, 23, 74, 18, 78, 21, 80, 25, 80, 32, 77, 36, 53, 42],
    [5, 77, 34, 69, 39, 73, 41, 78, 41, 85, 36, 88, 7, 94, 2, 92, 0, 87, 1, 81],
    [53, 65, 75, 58, 79, 62, 81, 67, 80, 74, 76, 77, 53, 84],
  ],
}

export function maskSignGround(
  scene: Phaser.Scene,
  object: { id: string; x: number; y: number; pixelRatio: number },
  image: Phaser.GameObjects.Image
) {
  const outlines = signOutlines[object.id]
  if (!outlines) return
  const graphics = scene.make.graphics({ x: object.x, y: object.y }, false)
  graphics.fillStyle(0xffffff)
  for (const outline of outlines) {
    graphics.beginPath()
    graphics.moveTo(outline[0] / object.pixelRatio, outline[1] / object.pixelRatio)
    for (let i = 2; i < outline.length; i += 2)
      graphics.lineTo(outline[i] / object.pixelRatio, outline[i + 1] / object.pixelRatio)
    graphics.closePath()
    graphics.fillPath()
  }
  const mask = graphics.createGeometryMask()
  image.setMask(mask)
  scene.events.once('shutdown', () => {
    image.clearMask()
    mask.destroy()
    graphics.destroy()
  })
}
