import type { ReactNode } from 'react'
import Box from '~common/ui/Box'
import NebulaOrb from '~common/ui/effects/NebulaOrb'

// The colours of each piece of the catalog, deep at the foot and light at the top; another piece
// takes the first.
const ORB_COLORS: Record<string, { color: string; highlight: string }> = {
  piano: { color: '#9a82e6', highlight: '#fbe4f0' },
  strings: { color: '#e5876f', highlight: '#fde8d2' },
  ambient: { color: '#6f9fdc', highlight: '#e8e2fb' },
  guitar: { color: '#cf9654', highlight: '#fbedc9' },
  harp: { color: '#55ad94', highlight: '#dff2fa' },
  organ: { color: '#7f86dc', highlight: '#f0e5fb' },
}

type MusicDiscProps = {
  id: string | null | undefined
  size: number
  /** The orb swirls while the music plays and rests while it is paused. */
  isPlaying?: boolean
  children?: ReactNode
}

/** A piece of music as a sphere of its colours, which swirl while it plays. */
const MusicDisc = ({ id, size, isPlaying = false, children }: MusicDiscProps) => {
  const colors = ORB_COLORS[id ?? ''] ?? ORB_COLORS.piano!
  return (
    <Box className="items-center justify-center" style={{ width: size, height: size }}>
      <NebulaOrb
        size={size}
        color={colors.color}
        highlightColor={colors.highlight}
        paused={!isPlaying}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      {children}
    </Box>
  )
}

export default MusicDisc
