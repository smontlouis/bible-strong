// A world drawn as a painting hung on a wall: a carved frame around the map, its shadow, a lit
// wall and a small museum plaque. The camera stays on the map while the visitor walks; zooming
// out reveals the frame, then the whole painting on its wall, instead of the map's raw edge.
// The frame image is built for the map by scripts/build-world-frame.py: transparent inside, its
// outer edge on the rectangle drawn here.
import Phaser from 'phaser'

export type FrameLook = {
  /** The frame image from scripts/build-world-frame.py, built with the same border and lip. */
  texture: { key: string; url: string }
  /** Width of the frame on the map, in map units, and how much of it covers the map's edge. */
  border: number
  lip: number
  /** Wall visible around the frame at the farthest zoom, in map units. */
  margin: number
  /** The wall's colour, also the camera's background. */
  wall: string
  /** The plaque under the painting. */
  plaque?: { text: string; font: string; color: string; background: number }
}

const DEPTH = 2600

/** The drawn extent the camera may zoom out to: the map, its frame and the wall around it. */
export function framedExtent(width: number, height: number, look: FrameLook) {
  const outside = look.border - look.lip + look.margin
  return { width: width + outside * 2, height: height + outside * 2 }
}

export function loadFrame(scene: Phaser.Scene, look: FrameLook) {
  scene.load.image(look.texture.key, look.texture.url)
}

export class WorldFrame {
  constructor(scene: Phaser.Scene, width: number, height: number, look: FrameLook) {
    const { texture, border, lip, margin } = look
    // The frame's outer rectangle, in map units.
    const x = -(border - lip)
    const y = -(border - lip)
    const w = width + (border - lip) * 2
    const h = height + (border - lip) * 2
    const extent = framedExtent(width, height, look)

    // The wall, dark away from the painting and lit around it: the light fades out with no edge.
    // Its grain is one small texture laid again and again: a tile sprite this size kept a canvas
    // and a copy of it, over a gigabyte, enough for iOS to kill the page.
    scene.cameras.main.setBackgroundColor(look.wall)
    const grain = grainTexture(scene, look.wall)
    // Three times the framed painting covers what the farthest zoom shows, on any screen shape.
    const tiles = Math.ceil((Math.max(extent.width, extent.height) * 3) / (GRAIN_SIZE * GRAIN_SCALE))
    const wall = scene.add
      .blitter(width / 2 - (tiles * GRAIN_SIZE * GRAIN_SCALE) / 2, height / 2 - (tiles * GRAIN_SIZE * GRAIN_SCALE) / 2, grain)
      .setScale(GRAIN_SCALE)
      .setDepth(-300)
    for (let row = 0; row < tiles; row++)
      for (let column = 0; column < tiles; column++) wall.create(column * GRAIN_SIZE, row * GRAIN_SIZE)
    scene.add
      .image(width / 2, height / 2 - margin * 0.3, lightTexture(scene))
      .setDisplaySize(extent.width * 1.9, extent.height * 2.2)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setDepth(-290)
    // The painting's shadow on the wall, cast slightly downwards.
    scene.add
      .image(x + w / 2, y + h / 2 + border * 0.3, shadowTexture(scene))
      .setDisplaySize(w / SHADOW_BODY, h / SHADOW_BODY)
      .setAlpha(0.8)
      .setDepth(-120)

    scene.add.image(x, y, texture.key).setOrigin(0).setDisplaySize(w, h).setDepth(DEPTH)

    // The museum plaque, centred under the frame.
    if (look.plaque) {
      const { text, font, color, background } = look.plaque
      const plaqueY = y + h + margin * 0.32
      const plate = scene.add.graphics().setDepth(DEPTH)
      const label = scene.add
        .text(width / 2, plaqueY, text, { fontFamily: font, fontSize: '40px', color })
        .setOrigin(0.5)
        .setScale(0.5)
        .setDepth(DEPTH + 1)
      const draw = () => {
        const pw = label.displayWidth + 40
        const ph = label.displayHeight + 18
        plate
          .clear()
          .fillStyle(0x000000, 0.28)
          .fillRoundedRect(width / 2 - pw / 2 + 2, plaqueY - ph / 2 + 3, pw, ph, 3)
          .fillStyle(background, 1)
          .fillRoundedRect(width / 2 - pw / 2, plaqueY - ph / 2, pw, ph, 3)
          .lineStyle(1.2, 0x8a6a2c, 0.9)
          .strokeRoundedRect(width / 2 - pw / 2 + 3, plaqueY - ph / 2 + 3, pw - 6, ph - 6, 2)
      }
      draw()
      // Draw again once the web font has arrived, so the plate fits the real text.
      void document.fonts?.load(`40px ${font.split(',')[0]}`).then(() => {
        if (!label.scene) return
        label.setText(text)
        draw()
      })
    }
  }
}

/** The grain's texture, in pixels, and its size on the map: half a map unit per pixel. */
const GRAIN_SIZE = 1024
const GRAIN_SCALE = 0.5

/** A faint plaster grain on the wall's colour, repeated. */
function grainTexture(scene: Phaser.Scene, wall: string) {
  const key = `world-wall-${wall}`
  if (scene.textures.exists(key)) return key
  const size = GRAIN_SIZE
  const canvas = scene.textures.createCanvas(key, size, size)!
  const context = canvas.getContext()
  context.fillStyle = wall
  context.fillRect(0, 0, size, size)
  const image = context.getImageData(0, 0, size, size)
  for (let i = 0; i < image.data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 10
    image.data[i] += grain
    image.data[i + 1] += grain
    image.data[i + 2] += grain
  }
  context.putImageData(image, 0, 0)
  canvas.refresh()
  return key
}

/** A soft pool of warm light from a picture lamp. */
function lightTexture(scene: Phaser.Scene) {
  const key = 'world-wall-light'
  if (scene.textures.exists(key)) return key
  const size = 256
  const canvas = scene.textures.createCanvas(key, size, size)!
  const context = canvas.getContext()
  const light = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  light.addColorStop(0, 'rgba(255, 200, 150, 0.32)')
  light.addColorStop(0.5, 'rgba(255, 190, 140, 0.12)')
  light.addColorStop(1, 'rgba(255, 180, 130, 0)')
  context.fillStyle = light
  context.fillRect(0, 0, size, size)
  canvas.refresh()
  return key
}

/** The share of the shadow texture the rectangle itself covers; the rest is its blur. */
const SHADOW_BODY = 0.72

/** A blurred rectangle, the painting's shadow on the wall. */
function shadowTexture(scene: Phaser.Scene) {
  const key = 'world-frame-shadow'
  if (scene.textures.exists(key)) return key
  const size = 256
  const canvas = scene.textures.createCanvas(key, size, size)!
  const context = canvas.getContext()
  // Draw the rectangle off the canvas and keep only its shadow.
  const inset = (size * (1 - SHADOW_BODY)) / 2
  context.shadowColor = 'rgba(0, 0, 0, 0.85)'
  context.shadowBlur = 24
  context.shadowOffsetX = size * 2
  context.fillRect(inset - size * 2, inset, size - inset * 2, size - inset * 2)
  canvas.refresh()
  return key
}
