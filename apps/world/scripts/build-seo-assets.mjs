import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'

// Reuse the approved neutral frame extracted from the game's sprite sheet.
// Multiply RGB by the game's blue tint, preserving the original black eyes.
const sprite = new URL('../public/assets/avatars/short-slime/thumbnail.png', import.meta.url)
const side = 256
const pixels = await sharp(sprite.pathname)
  .resize(224, 224, { fit: 'contain', background: '#00000000' })
  .extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#00000000' })
  .ensureAlpha()
  .raw()
  .toBuffer()
const outlined = Buffer.alloc(pixels.length)
for (let y = 0; y < side; y++) {
  for (let x = 0; x < side; x++) {
    const offset = (y * side + x) * 4
    let outlineAlpha = 0
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        if (dx * dx + dy * dy > 16 || x + dx < 0 || x + dx >= side || y + dy < 0 || y + dy >= side)
          continue
        outlineAlpha = Math.max(outlineAlpha, pixels[((y + dy) * side + x + dx) * 4 + 3])
      }
    }
    const alpha = pixels[offset + 3] / 255
    const combinedAlpha = alpha + (outlineAlpha / 255) * (1 - alpha)
    for (const [channel, tint] of [115, 152, 242].entries())
      outlined[offset + channel] = combinedAlpha
        ? Math.round((((pixels[offset + channel] * tint) / 255) * alpha) / combinedAlpha)
        : 0
    outlined[offset + 3] = Math.round(combinedAlpha * 255)
  }
}
const source = await sharp(outlined, { raw: { width: side, height: side, channels: 4 } })
  .png()
  .toBuffer()
const publicRoot = new URL('../public/', import.meta.url)
await mkdir(new URL('icons/', publicRoot), { recursive: true })
await mkdir(new URL('social/', publicRoot), { recursive: true })
for (const [file, size, background] of [
  ['icons/favicon-32.png', 32, null],
  ['icons/icon-192.png', 192, null],
  ['icons/icon-512.png', 512, null],
  ['apple-touch-icon.png', 180, '#ffffff'],
]) {
  let icon = sharp(source).resize(size, size)
  if (background) icon = icon.flatten({ background })
  await icon.png().toFile(new URL(file, publicRoot).pathname)
}
// ICO directory containing one PNG image, supported by modern browsers.
const png = await sharp(source).resize(32, 32).png().toBuffer()
const header = Buffer.alloc(22)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
header[6] = header[7] = 32
header.writeUInt16LE(1, 10)
header.writeUInt16LE(32, 12)
header.writeUInt32LE(png.length, 14)
header.writeUInt32LE(22, 18)
await writeFile(new URL('favicon.ico', publicRoot), Buffer.concat([header, png]))

// Code-native social card layout using the same sprite as the favicon.
const layout = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<rect width="1200" height="630" fill="#f4f7ff"/>
<circle cx="1030" cy="310" r="290" fill="#e4ecff"/>
<g font-family="Arial, sans-serif" fill="#182444">
<text x="72" y="112" font-size="26" letter-spacing="4" fill="#4a68ae">BIBLE STRONG</text>
<text x="68" y="264" font-size="118" font-weight="700">World</text>
<text x="72" y="347" font-size="38" font-weight="700">Explore la Bible autrement.</text>
<text x="72" y="406" font-size="25" fill="#52617b">Un monde à découvrir. Des rencontres.</text>
<text x="72" y="444" font-size="25" fill="#52617b">Des jeux bibliques à partager.</text>
<text x="72" y="557" font-size="22" fill="#4a68ae">world.bible-strong.app</text>
</g></svg>`)
const character = await sharp(source).resize(430, 430).png().toBuffer()
await sharp(layout)
  .composite([{ input: character, left: 743, top: 110 }])
  .png()
  .toFile(new URL('social/world-og.png', publicRoot).pathname)
console.log('World icons and 1200 × 630 social card generated')
