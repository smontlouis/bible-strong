import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import Box from '~common/ui/Box'

// A colour for each piece of the catalog; another piece takes the first.
const DISC_COLORS: Record<string, [string, string]> = {
  piano: ['#c9b6f2', '#f3c4dd'],
  strings: ['#f2c6a0', '#e98f8f'],
  ambient: ['#9ecbe8', '#c3b4f0'],
  guitar: ['#f0d59a', '#d8a774'],
  harp: ['#a8e0c8', '#8ec5e6'],
  organ: ['#d7c1f0', '#9fa8e8'],
}

type MusicDiscProps = { id: string | null | undefined; size: number; children?: ReactNode }

/** The disc of a piece of music, in its colours, as HelloBible shows it. */
const MusicDisc = ({ id, size, children }: MusicDiscProps) => {
  const colors = DISC_COLORS[id ?? ''] ?? DISC_COLORS.piano!
  return (
    <Box
      className="overflow-hidden items-center justify-center"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* The label of the record. */}
      <Box
        className="absolute"
        style={{
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: size * 0.15,
          backgroundColor: 'rgba(255,255,255,0.35)',
        }}
      />
      {children}
    </Box>
  )
}

export default MusicDisc
