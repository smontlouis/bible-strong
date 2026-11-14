// The springs that tilt a card and light its foil, after pokemon-cards-css by Simon Goellner, and
// the textures of the foils, drawn once in the browser (ADR-0113).

export type Spring = { x: number; v: number; t: number; k: number; d: number }
export const spring = (value: number, k: number, d: number): Spring => ({
  x: value,
  v: 0,
  t: value,
  k,
  d,
})

/** Moves a spring one frame; false once it has come to rest. */
export const step = (s: Spring, still: boolean) => {
  if (still) {
    s.x = s.t
    s.v = 0
    return false
  }
  s.v = (s.v + (s.t - s.x) * s.k) * (1 - s.d)
  s.x += s.v
  if (Math.abs(s.v) < 0.002 && Math.abs(s.t - s.x) < 0.002) {
    s.x = s.t
    s.v = 0
    return false
  }
  return true
}

export const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max)
export const adjust = (
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
) => toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin)

// At rest the foil stays lit, as from a little above; the pointer only moves the light and adds glare.
export const REST = { x: 50, y: 32, shine: 0.75 }

export type Springs = Record<
  'rx' | 'ry' | 'gx' | 'gy' | 'go' | 'gl' | 'bx' | 'by' | 'tx' | 'ty' | 'sc' | 'spin' | 'flip',
  Spring
>

export const restingSprings = (): Springs => ({
  rx: spring(0, 0.08, 0.26),
  ry: spring(0, 0.08, 0.26),
  gx: spring(REST.x, 0.08, 0.26),
  gy: spring(REST.y, 0.08, 0.26),
  go: spring(REST.shine, 0.08, 0.26),
  gl: spring(0, 0.08, 0.26),
  bx: spring(adjust(REST.x, 0, 100, 37, 63), 0.08, 0.26),
  by: spring(adjust(REST.y, 0, 100, 33, 67), 0.08, 0.26),
  tx: spring(0, 0.045, 0.3),
  ty: spring(0, 0.045, 0.3),
  sc: spring(1, 0.045, 0.3),
  spin: spring(0, 0.04, 0.22),
  flip: spring(0, 0.07, 0.28),
})

/** Writes the springs of a card into the CSS variables its layers read. */
export const paint = (element: HTMLElement, s: Springs) => {
  const style = element.style
  const gx = s.gx.x
  const gy = s.gy.x
  style.setProperty('--pointer-x', `${gx.toFixed(2)}%`)
  style.setProperty('--pointer-y', `${gy.toFixed(2)}%`)
  style.setProperty(
    '--pointer-from-center',
    clamp(Math.sqrt((gy - 50) ** 2 + (gx - 50) ** 2) / 50, 0, 1).toFixed(3)
  )
  style.setProperty('--pointer-from-top', (gy / 100).toFixed(3))
  style.setProperty('--pointer-from-left', (gx / 100).toFixed(3))
  style.setProperty('--card-opacity', s.go.x.toFixed(3))
  style.setProperty('--glare-opacity', s.gl.x.toFixed(3))
  style.setProperty('--rotate-x', `${s.rx.x.toFixed(2)}deg`)
  style.setProperty('--rotate-y', `${s.ry.x.toFixed(2)}deg`)
  style.setProperty('--tx', (-s.rx.x / 14).toFixed(3))
  style.setProperty('--ty', (s.ry.x / 14).toFixed(3))
  style.setProperty('--background-x', `${s.bx.x.toFixed(2)}%`)
  style.setProperty('--background-y', `${s.by.x.toFixed(2)}%`)
  style.setProperty('--translate-x', `${s.tx.x.toFixed(1)}px`)
  style.setProperty('--translate-y', `${s.ty.x.toFixed(1)}px`)
  style.setProperty('--card-scale', s.sc.x.toFixed(4))
  style.setProperty('--spin', `${s.spin.x.toFixed(2)}deg`)
  style.setProperty('--flip', `${s.flip.x.toFixed(2)}deg`)
}

// The textures of the foils are drawn once in the browser: no image is borrowed.
let texturesDrawn = false
export const drawTextures = () => {
  if (texturesDrawn) return
  texturesDrawn = true
  const canvas = (size: number) => {
    const element = document.createElement('canvas')
    element.width = element.height = size
    return [element, element.getContext('2d')] as const
  }
  const [glitter, g] = canvas(220)
  if (g) {
    g.fillStyle = '#000'
    g.fillRect(0, 0, 220, 220)
    for (let index = 0; index < 700; index += 1) {
      g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.8 + 0.2).toFixed(2)})`
      g.beginPath()
      g.arc(Math.random() * 220, Math.random() * 220, Math.random() * 1.3 + 0.3, 0, Math.PI * 2)
      g.fill()
    }
  }
  const [nebula, n] = canvas(420)
  if (n) {
    n.fillStyle = '#05030b'
    n.fillRect(0, 0, 420, 420)
    n.globalCompositeOperation = 'lighter'
    const hues = [280, 300, 190, 220, 320, 260, 170]
    for (let index = 0; index < 14; index += 1) {
      const x = Math.random() * 420
      const y = Math.random() * 420
      const radius = Math.random() * 150 + 60
      const gradient = n.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, `hsla(${hues[index % hues.length]},80%,60%,0.32)`)
      gradient.addColorStop(1, 'hsla(0,0%,0%,0)')
      n.fillStyle = gradient
      n.fillRect(0, 0, 420, 420)
    }
    for (let index = 0; index < 260; index += 1) {
      n.fillStyle = `rgba(255,255,255,${(Math.random() * 0.9).toFixed(2)})`
      const big = Math.random() < 0.1 ? 2 : 1
      n.fillRect(Math.random() * 420, Math.random() * 420, big, big)
    }
  }
  const root = document.documentElement.style
  root.setProperty('--ac-glitter', `url(${glitter.toDataURL('image/png')})`)
  root.setProperty('--ac-nebula', `url(${nebula.toDataURL('image/png')})`)
}
