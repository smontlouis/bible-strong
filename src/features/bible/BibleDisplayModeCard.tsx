import type { ReactNode } from 'react'
import { Pressable } from 'react-native'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import Text from '~common/ui/Text'

type Props = {
  label: string
  description: string
  selected: boolean
  onPress: () => void
  downloadRequired?: boolean
  downloading?: boolean
  downloadProgress?: number
  downloadAccessibilityLabel?: string
  onDownloadPress?: () => void
  children: ReactNode
}

const BibleDisplayModeCard = ({
  label,
  description,
  selected,
  onPress,
  downloadRequired = false,
  downloading = false,
  downloadProgress = 0,
  downloadAccessibilityLabel,
  onDownloadPress,
  children,
}: Props) => (
  <Box flex height={148} position="relative">
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: downloading }}
      accessibilityLabel={
        downloadRequired ? downloadAccessibilityLabel : `${label}. ${description}`
      }
      disabled={downloading}
      onPress={downloadRequired ? onDownloadPress : onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.72 : 1 })}
    >
      <Box
        height={148}
        p={12}
        borderRadius={16}
        borderWidth={selected ? 2 : 1}
        borderColor={selected ? 'primary' : 'border'}
        bg={selected ? 'lightPrimary' : 'reverse'}
        bgOpacity="050"
        opacity={downloadRequired ? 0.72 : 1}
      >
        <Text
          bold
          fontSize={15}
          color={selected ? 'primary' : 'default'}
          textAlign="center"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Box flex center>
          {children}
        </Box>
        <Text
          fontSize={11}
          color="tertiary"
          textAlign="center"
          numberOfLines={1}
          px={downloadRequired ? 28 : 0}
        >
          {description}
        </Text>
        {downloadRequired && (
          <Box
            position="absolute"
            bottom={0}
            left={0}
            width={44}
            height={44}
            center
            pointerEvents="none"
          >
            {downloading ? (
              <Progress progress={Math.max(downloadProgress, 0.04)} size={22} thickness={2.5} />
            ) : (
              <FeatherIcon name="download-cloud" size={17} color="primary" />
            )}
          </Box>
        )}
      </Box>
    </Pressable>
  </Box>
)

export default BibleDisplayModeCard
