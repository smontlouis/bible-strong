/**
 * The metallic ring on the web and in the desktop app (2026-11-26), without Skia, which the web
 * would have to download: a conic gradient of the same colours, mirrored like the shader's,
 * turns slowly inside a ring cut out by a CSS mask, with a blurred copy behind it for the glow.
 * Close to index.tsx, not the same shading.
 */
import { motion } from 'motion/react'
import { StyleSheet, View } from 'react-native'
import { CONF, DEFAULT_COLORS } from './const'
import type { MetalProps } from './types'

/** One turn of the gradient, in seconds, at speed 1. */
const TURN = 9

const Metal = ({
  children,
  colors = DEFAULT_COLORS,
  borderWidth = CONF.borderWidth,
  borderRadius,
  opacity = CONF.opacity,
  glow = CONF.glow,
  speed = CONF.speed,
  bands = CONF.bands,
  paused = false,
  style,
}: MetalProps) => {
  const own = StyleSheet.flatten(style)?.borderRadius
  const radius = borderRadius ?? (typeof own === 'number' ? own : 9999)
  const stops = colors.map(stop => (typeof stop === 'string' ? stop : stop.color))
  // Mirrored, then repeated `bands` times around the ring, as the shader sweeps its palette.
  const mirrored = [...stops, ...stops.slice(0, -1).reverse()]
  const sweep = Array.from({ length: Math.max(1, Math.round(bands)) }, () => mirrored).flat()
  const gradient = `conic-gradient(from 0deg, ${[...sweep, sweep[0]].join(', ')})`
  const ring = (blur: number) => (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        padding: borderWidth,
        overflow: 'hidden',
        // Only the border shows: the content box is cut out of the padding box.
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        filter: blur ? `blur(${blur}px)` : undefined,
      }}
    >
      <motion.div
        style={{
          position: 'absolute',
          left: '-50%',
          top: '-50%',
          width: '200%',
          height: '200%',
          background: gradient,
        }}
        animate={paused ? { rotate: 0 } : { rotate: 360 }}
        transition={
          paused ? { duration: 0 } : { duration: TURN / speed, ease: 'linear', repeat: Infinity }
        }
      />
    </div>
  )
  return (
    <View style={style}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
        {glow > 0 ? (
          <div style={{ position: 'absolute', inset: -borderWidth, opacity: glow }}>
            {ring(borderWidth * 2.5)}
          </div>
        ) : null}
        {ring(0)}
      </View>
    </View>
  )
}

export { METAL_COLORS } from './const'

export default Metal
