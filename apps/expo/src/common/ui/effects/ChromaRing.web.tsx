import './effects.web.css'

import { View } from 'react-native'
import type { ChromaRingProps } from './ChromaRing'

/**
 * The Chroma Ring on the Web and in the desktop app, where Skia is not loaded: a turning conic
 * light seen through the gap between the edge and what the ring holds.
 */
const ChromaRing = ({
  borderRadius,
  borderWidth = 2,
  base,
  glow,
  background,
  active = true,
  children,
  style,
}: ChromaRingProps) => (
  <View style={[{ borderRadius, overflow: 'hidden', padding: borderWidth }, style]}>
    <div
      className="bs-chroma"
      data-active={active ? 'true' : 'false'}
      style={{ position: 'absolute', inset: 0, backgroundColor: base, opacity: active ? 1 : 0.5 }}
    >
      <div
        className="bs-chroma-spin"
        style={{
          backgroundImage: `conic-gradient(from 0deg, ${base} 0deg, ${glow} 30deg, #ff9fd2 50deg, ${base} 90deg, ${base} 150deg, ${glow} 180deg, #9fd8ff 200deg, ${base} 240deg, ${base} 290deg, ${glow} 320deg, ${base} 360deg)`,
        }}
      />
    </div>
    <View
      style={{ backgroundColor: background, borderRadius: Math.max(0, borderRadius - borderWidth) }}
    >
      {children}
    </View>
  </View>
)

export default ChromaRing
