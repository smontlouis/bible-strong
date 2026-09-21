import type Phaser from 'phaser'

export function isReactiveBush(id: string) {
  return /-shrubs?$/.test(id) || id === 'plaza-south-east-tree'
}

// This SAM cutout contains yellow ground. Keep only its teal foliage and ink;
// apply this reviewed, asset-specific correction once when preparing the texture.
export function cleanBushGround(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b] = pixels.subarray(i, i + 3)
    if (r > g * 0.72 || b < g * 0.68) pixels[i + 3] = 0
  }
}

export function prepareBushCutout(
  scene: Phaser.Scene,
  id: string,
  image: Phaser.GameObjects.Image
) {
  if (id !== 'plaza-east-shrub') return
  const key = `${image.texture.key}-foliage`
  if (!scene.textures.exists(key)) {
    const source = image.texture.getSourceImage() as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.drawImage(source, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    cleanBushGround(pixels.data)
    context.putImageData(pixels, 0, 0)
    scene.textures.addCanvas(key, canvas)
  }
  image.setTexture(key)
}
