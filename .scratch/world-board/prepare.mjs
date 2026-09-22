import { createRequire } from 'node:module'
const sharp = createRequire(new URL('../../apps/world/package.json', import.meta.url))('sharp')
import { writeFile } from 'node:fs/promises'
const root = 'apps/world/public/assets/'
const input = '.scratch/world-board/normalized.png'
// Feather only the integration perimeter; the generated artwork remains intact.
const mask = Buffer.from(`<svg width="500" height="420"><filter id="soft"><feGaussianBlur stdDeviation="3"/></filter><path filter="url(#soft)" fill="white" d="M 183,79 L 388,151 L 396,329 L 375,366 L 289,365 L 145,269 L 145,198 L 183,174 Z"/></svg>`)
await sharp(input).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).webp({lossless:true}).toFile(root+'map/edits/community-board.webp')
// Exact foreground silhouette, at the same raster origin as the reviewed patch.
const silhouette=Buffer.from(`<svg width="500" height="420"><path fill="white" d="M200,99 L218,91 L375,167 L375,179 L366,184 L366,325 L361,331 L356,334 L351,331 L347,329 L341,326 L341,303 L220,249 L220,264 L217,268 L212,265 L209,267 L205,264 L202,260 L203,114 L200,111 Z"/></svg>`)
await sharp(input).ensureAlpha().composite([{input:silhouette,blend:'dest-in'}]).webp({lossless:true}).toFile(root+'occlusion/community-board.webp')
