import './effects.web.css'

import type { CSSProperties } from 'react'
import { View } from 'react-native'
import type { NebulaOrbProps } from './NebulaOrb'

/** Halfway between two colours `#rrggbb`. */
const mix = (a: string, b: string, share: number) => {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return a
  const rgb = [0, 1, 2].map(i =>
    Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * share)
  )
  return `rgb(${rgb.join(', ')})`
}

/**
 * The Nebula Orb on the Web and in the desktop app, where Skia is not loaded: blurred patches of
 * its colours drift round under a light from above, and fade to a new piece's colours.
 */
const NebulaOrb = ({ size, color, highlightColor, paused = false, style }: NebulaOrbProps) => {
  const blur = Math.max(4, Math.round(size * 0.12))
  const light = mix(highlightColor, color, 0.5)
  return (
    <View style={[{ width: size, height: size }, style]}>
      <div
        className="bs-orb"
        data-paused={paused ? 'true' : 'false'}
        style={
          {
            width: size,
            height: size,
            backgroundColor: color,
            '--bs-orb-blur': `${blur}px`,
          } as CSSProperties
        }
      >
        <div className="bs-orb-swirl">
          <div
            className="bs-orb-blob"
            style={{ left: '12%', top: '18%', width: '46%', height: '40%', backgroundColor: light }}
          />
          <div
            className="bs-orb-blob"
            style={{
              right: '10%',
              top: '40%',
              width: '40%',
              height: '44%',
              backgroundColor: color,
            }}
          />
          <div
            className="bs-orb-blob"
            style={{
              left: '30%',
              bottom: '14%',
              width: '36%',
              height: '30%',
              backgroundColor: highlightColor,
              opacity: 0.7,
            }}
          />
        </div>
        <div className="bs-orb-light" style={{ backgroundColor: highlightColor }} />
      </div>
    </View>
  )
}

export default NebulaOrb
