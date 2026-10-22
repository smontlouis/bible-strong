import { Image } from 'react-native'
import { useTheme } from '~themes/ThemeProvider'
import Box from '~common/ui/Box'
interface SnapshotPlaceholderProps {
  uri?: string
}

/**
 * Shows a static snapshot image for inactive Bible tabs.
 * Falls back to a themed background when no snapshot is available.
 */
const SnapshotPlaceholder = ({ uri }: SnapshotPlaceholderProps) => {
  const theme = useTheme()

  if (!uri) {
    return <Box className="overflow-hidden border-continuous flex-[1] bg-reverse" />
  }

  return (
    <Image
      source={{ uri }}
      style={{ flex: 1, backgroundColor: theme.colors.reverse }}
      resizeMode="cover"
    />
  )
}

export default SnapshotPlaceholder
