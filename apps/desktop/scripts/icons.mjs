// Regenerates the desktop app's icons and installer images (`yarn icons`, macOS only).
//
// - Windows and Linux: Tauri's set, from the mark (`apps/expo/assets/images/mark.png`, rendered from
//   `design-system/project/assets/Logos/bible-strong-mark.svg`).
// - macOS: the iOS app's Icon Composer file (`AppIcon.icon`) compiled by actool. `Assets.car`
//   carries the icon of every macOS from 11, drawn to the macOS grid; `icon.icns` is the
//   fallback the bundle names. tauri.conf.json copies `Assets.car` into the bundle and
//   `Info.plist` names it (`CFBundleIconName`).
// - The DMG window's background (1x and 2x in one TIFF) and the NSIS installer's header and
//   sidebar (24-bit BMP), drawn from the design-system tokens and the mark, with Pulp Display
//   from the app's own fonts.
//
// Needs Xcode (actool, tiffutil), rsvg-convert and ImageMagick (`brew install librsvg imagemagick`).
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin') throw new Error('yarn icons needs macOS (actool, tiffutil)')

const desktop = join(dirname(fileURLToPath(import.meta.url)), '..')
const root = join(desktop, '..', '..')
const icons = join(desktop, 'src-tauri', 'icons')
const installer = join(desktop, 'src-tauri', 'installer')
const work = mkdtempSync(join(tmpdir(), 'bible-strong-icons-'))
const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: 'inherit', ...options })

try {
  // Windows and Linux.
  run('yarn', ['tauri', 'icon', '../expo/assets/images/mark.png'], { cwd: desktop })
  // It also writes mobile icons, which this app has no use for.
  for (const mobile of ['android', 'ios'])
    rmSync(join(icons, mobile), { recursive: true, force: true })

  // macOS.
  run('xcrun', [
    'actool',
    join(root, 'apps/expo/assets/images/AppIcon.icon'),
    '--compile',
    work,
    '--platform',
    'macosx',
    '--minimum-deployment-target',
    '11.0',
    '--app-icon',
    'AppIcon',
    '--output-partial-info-plist',
    join(work, 'partial.plist'),
    '--errors',
    '--warnings',
  ])
  copyFileSync(join(work, 'AppIcon.icns'), join(icons, 'icon.icns'))
  copyFileSync(join(work, 'Assets.car'), join(icons, 'Assets.car'))

  // Installer images.
  const tokens = JSON.parse(readFileSync(join(root, 'design-system/project/tokens.json'), 'utf8'))
  const color = name => {
    const token = tokens.color.tokens.find(entry => entry.name === name)
    return typeof token.value === 'string' ? token.value : token.value.light
  }
  const brand = color('blue-brand')
  const ink = color('ink')
  const mark = readFileSync(
    join(root, 'design-system/project/assets/Logos/bible-strong-mark.svg'),
    'utf8'
  )
    .replace(/<svg[^>]*>/, '')
    .replace('</svg>', '')
  // The mark at `size`, its top left at x, y (it is drawn on a 102-unit square).
  const placeMark = (x, y, size) =>
    `<g transform="translate(${x} ${y}) scale(${size / 102})">${mark}</g>`
  const svg = (width, height, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
  const text = (x, y, size, weight, content, opacity = 1) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="Pulp Display" font-size="${size}" font-weight="${weight}" fill="${ink}" fill-opacity="${opacity}">${content}</text>`

  // rsvg-convert finds Pulp Display among the app's fonts.
  const fontsConf = join(work, 'fonts.conf')
  writeFileSync(
    fontsConf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${join(root, 'apps/expo/src/assets/fonts')}</dir><cachedir>${join(work, 'font-cache')}</cachedir></fontconfig>`
  )
  const render = (name, source, scale = 1) => {
    const file = join(work, `${name}.svg`)
    writeFileSync(file, source)
    const png = join(work, `${name}@${scale}x.png`)
    run('rsvg-convert', ['--zoom', String(scale), '--output', png, file], {
      env: { ...process.env, FONTCONFIG_FILE: fontsConf },
    })
    return png
  }

  mkdirSync(installer, { recursive: true })

  // The DMG window, 660 by 400: the app at x 180, Applications at x 480 (tauri.conf.json), an
  // arrow between them and the instruction below. Finder writes the icons' names in black, or
  // in white in dark mode: the brand blue keeps both legible.
  const arrow = `<g fill="none" stroke="${ink}" stroke-opacity="0.7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M275 180 H385"/><path d="M373 168 L386 180 L373 192"/></g>`
  const dmg = svg(
    660,
    400,
    `<rect width="660" height="400" fill="${brand}"/>${arrow}` +
      text(330, 332, 15, 600, 'Glissez Bible Strong dans Applications') +
      text(330, 354, 13, 400, 'Drag Bible Strong to Applications', 0.75)
  )
  run('tiffutil', [
    '-cathidpicheck',
    render('dmg', dmg, 1),
    render('dmg', dmg, 2),
    '-out',
    join(installer, 'dmg-background.tiff'),
  ])

  // NSIS, which takes 24-bit BMP without alpha.
  const bmp = (png, name) =>
    run('magick', [
      png,
      '-background',
      '#ffffff',
      '-alpha',
      'remove',
      '-type',
      'TrueColor',
      `BMP3:${join(installer, name)}`,
    ])
  // The welcome and finish pages' sidebar, 164 by 314: the mark and the name on the brand blue.
  bmp(
    render(
      'nsis-sidebar',
      svg(
        164,
        314,
        `<rect width="164" height="314" fill="${brand}"/>${placeMark(50, 64, 64)}` +
          text(82, 166, 17, 600, 'Bible Strong') +
          text(82, 186, 12, 400, 'Bible d’étude', 0.75)
      )
    ),
    'nsis-sidebar.bmp'
  )
  // The inner pages' header, 150 by 57, on the installer's white: the mark alone.
  bmp(
    render(
      'nsis-header',
      svg(150, 57, `<rect width="150" height="57" fill="#ffffff"/>${placeMark(100, 10, 37)}`)
    ),
    'nsis-header.bmp'
  )
} finally {
  rmSync(work, { recursive: true, force: true })
}
