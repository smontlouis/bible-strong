import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const kind = 'fish-west'
const work = resolve(root, `art-workbench/experiments/ambient-${kind}-tile-v1`)
const output = resolve(root, `public/assets/ambience/${kind}-tile`)
await mkdir(output, { recursive: true })
const crop = { left: 2, top: 30, width: 96, height: 127 }
const sprites = []
for (let frame = 1; frame <= 120; frame++) {
  const pixels = await sharp(resolve(work, `frames/${String(frame).padStart(3, '0')}.png`)).removeAlpha().raw().toBuffer()
  const rgba = Buffer.alloc(crop.width * crop.height * 4)
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const source = ((y + crop.top) * 258 + x + crop.left) * 3
    const [r, g, b] = pixels.subarray(source, source + 3)
    const edge = Math.min(x, y, crop.width - 1 - x, crop.height - 1 - y)
    // The fixed interior water mask preserves every original tile edge and all foliage.
    const coastDistance = (100 - .35 * (y + crop.top - 80) - (x + crop.left)) / 1.06
    const feather = Math.max(0, Math.min(1, Math.min(edge, coastDistance) / 7))
    const alpha = feather * feather * (3 - 2 * feather)
    const i = (y * crop.width + x) * 4
    rgba[i] = r; rgba[i+1] = g; rgba[i+2] = b; rgba[i+3] = Math.round(alpha * 255)
  }
  sprites.push(rgba)
}
// Match the last pose to the first with a short low-opacity blend.
for (let f = 114; f < 120; f++) {
  const blend = (f - 113) / 6
  for (let i = 0; i < sprites[f].length; i++) sprites[f][i] = Math.round(sprites[f][i] * (1 - blend) + sprites[0][i] * blend)
}
const cellW = crop.width + 4, cellH = crop.height + 4, columns = 13
const width = cellW * columns, height = cellH * Math.ceil(sprites.length / columns)
const frames = {}, composites = []
for (let f = 0; f < sprites.length; f++) {
  const x = (f % columns) * cellW + 2, y = Math.floor(f / columns) * cellH + 2
  const input = await sharp(sprites[f], { raw: {width:crop.width,height:crop.height,channels:4} }).png().toBuffer()
  composites.push({input,left:x,top:y})
  frames[`ambient-${f}`] = { frame: {x,y,w:crop.width,h:crop.height}, rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:crop.width,h:crop.height},sourceSize:{w:crop.width,h:crop.height} }
  if ([0,30,60,90,119].includes(f)) await writeFile(resolve(work, `cutout-${f}.png`), input)
}
await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(composites).webp({lossless:true}).toFile(resolve(output,'atlas.webp'))
await writeFile(resolve(output,'atlas.json'),JSON.stringify({frames,meta:{image:'atlas.webp',size:{w:width,h:height}}}))
const manifest = {id:'fish-west-tile',x:511.5+crop.left/2,y:383.5+crop.top/2,width:crop.width/2,height:crop.height/2,frameCount:120,frameRate:12,sourceTile:'4/4-3',depth:-79}
await writeFile(resolve(root,`src/generated/${kind}-tile.json`),JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify({manifest,atlas:{width,height}}))
