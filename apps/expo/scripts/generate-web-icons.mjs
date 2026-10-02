// Regenerates the committed PWA icons in public/icons from the app icon.
// Requires ImageMagick 7 (`magick`); the PNGs are committed, so builds never run this.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const icon = join(appRoot, 'assets/images/icon-2.png')
const background = join(appRoot, 'assets/images/background-image.png')
const output = join(appRoot, 'public/icons')
const magick = (...args) => execFileSync('magick', args, { stdio: 'inherit' })

// The source is a full-bleed 1024 px square: grey gradient, white disc (r = 424), blue dot.
const SOURCE_SIZE = 1024
const DISC_RADIUS = 422
// Maskable icons must keep their content inside the central 80 % circle.
const MASKABLE_DISC_RATIO = 0.76

mkdirSync(output, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'web-icons-'))

try {
  const opaque = (size, name) =>
    magick(icon, '-resize', `${size}x${size}`, '-strip', '-alpha', 'off', join(output, name))

  opaque(180, 'apple-touch-icon.png')
  opaque(192, 'icon-192.png')
  opaque(512, 'icon-512.png')

  const center = SOURCE_SIZE / 2
  const disc = join(work, 'disc.png')
  magick(
    icon,
    '(',
    '-size',
    `${SOURCE_SIZE}x${SOURCE_SIZE}`,
    'xc:black',
    '-fill',
    'white',
    '-draw',
    `circle ${center},${center} ${center},${center - DISC_RADIUS}`,
    ')',
    '-alpha',
    'off',
    '-compose',
    'CopyOpacity',
    '-composite',
    '-trim',
    '+repage',
    disc
  )

  const maskable = (size, name) => {
    const discSize = Math.round(size * MASKABLE_DISC_RATIO)
    magick(
      background,
      '-colorspace',
      'sRGB',
      '-type',
      'TrueColor',
      '-resize',
      `${size}x${size}`,
      '(',
      disc,
      '-resize',
      `${discSize}x${discSize}`,
      ')',
      '-gravity',
      'center',
      '-compose',
      'Over',
      '-composite',
      '-strip',
      '-alpha',
      'off',
      '-type',
      'TrueColor',
      join(output, name)
    )
  }

  maskable(192, 'maskable-192.png')
  maskable(512, 'maskable-512.png')
} finally {
  rmSync(work, { recursive: true, force: true })
}
