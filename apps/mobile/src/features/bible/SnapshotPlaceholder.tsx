import { Image } from 'react-native'
import { useTheme } from '@emotion/react'
import Box from '~common/ui/Box'

interface SnapshotPlaceholderProps {
  base64?: string
}

/**
 * Shows a static snapshot image for inactive Bible tabs.
 * Falls back to a themed background when no snapshot is available.
 */
const SnapshotPlaceholder = ({ base64 }: SnapshotPlaceholderProps) => {
  const theme = useTheme()

  if (!base64) {
    return <Box flex={1} bg="reverse" />
  }

  return (
    <Image
      source={{ uri: `data:image/jpeg;base64,${base64}` }}
      style={{ flex: 1, backgroundColor: theme.colors.reverse }}
      resizeMode="cover"
    />
  )
}

export default SnapshotPlaceholder
