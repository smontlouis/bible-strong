import type { ReactNode } from 'react'
import { Pressable } from 'react-native'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import Radio from '~common/ui/Radio'
import Text from '~common/ui/Text'

type Props = {
  label: string
  description: string
  layout?: 'card' | 'list'
  selected: boolean
  disabled?: boolean
  onPress: () => void
  downloadRequired?: boolean
  downloading?: boolean
  downloadDisabled?: boolean
  downloadProgress?: number
  downloadAccessibilityLabel?: string
  onDownloadPress?: () => void
  children: ReactNode
}

const BibleDisplayModeCard = ({
  label,
  description,
  layout = 'card',
  selected,
  disabled = false,
  onPress,
  downloadRequired = false,
  downloading = false,
  downloadDisabled = false,
  downloadProgress = 0,
  downloadAccessibilityLabel,
  onDownloadPress,
  children,
}: Props) => {
  const isList = layout === 'list'
  const showDownloadControl = downloadRequired || downloading
  const interactionDisabled = disabled || downloading || downloadRequired

  return (
    <Box flex={isList ? undefined : 1} height={isList ? 92 : 148} position="relative">
      <Pressable
        accessibilityRole={isList ? 'radio' : 'button'}
        accessibilityState={
          isList && !showDownloadControl
            ? { checked: selected, disabled: interactionDisabled }
            : { selected, disabled: interactionDisabled }
        }
        accessibilityLabel={`${label}. ${description}`}
        disabled={interactionDisabled}
        onPress={onPress}
        style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.72 : 1 })}
      >
        <Box
          height={isList ? 92 : 148}
          p={isList ? 16 : 12}
          borderRadius={16}
          borderWidth={isList ? 1 : selected ? 2 : 1}
          borderColor={isList ? 'border' : selected ? 'primary' : 'border'}
          bg={isList ? 'reverse' : selected ? 'lightPrimary' : 'reverse'}
          bgOpacity="050"
          opacity={disabled || downloadRequired ? 0.5 : 1}
          row={isList}
          alignItems={isList ? 'center' : undefined}
          gap={isList ? 12 : undefined}
        >
          {isList &&
            (showDownloadControl ? (
              <Box width={22} height={22} center pointerEvents="none">
                {downloading ? (
                  <Progress progress={Math.max(downloadProgress, 0.04)} size={22} thickness={2.5} />
                ) : (
                  <FeatherIcon
                    name={downloadDisabled ? 'wifi-off' : 'download-cloud'}
                    size={19}
                    color="default"
                  />
                )}
              </Box>
            ) : (
              <Radio selected={selected} size={22} />
            ))}
          <Box flex={isList ? 1.15 : undefined} justifyContent={isList ? 'center' : undefined}>
            <Text
              bold
              fontSize={isList ? 14 : 15}
              color={selected ? 'primary' : 'default'}
              textAlign={isList ? 'left' : 'center'}
              numberOfLines={isList ? 2 : 1}
              lineHeight={isList ? 17 : undefined}
            >
              {label}
            </Text>
            {isList && (
              <Text fontSize={10} color="tertiary" numberOfLines={2} lineHeight={13} mt={2}>
                {description}
              </Text>
            )}
          </Box>
          <Box flex={1} center={!isList} alignItems={isList ? 'flex-end' : undefined}>
            {children}
          </Box>
          {!isList && (
            <Text
              fontSize={11}
              color="tertiary"
              textAlign="center"
              numberOfLines={1}
              px={showDownloadControl ? 28 : 0}
            >
              {description}
            </Text>
          )}
          {showDownloadControl && !isList && (
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
                <FeatherIcon
                  name={downloadDisabled ? 'wifi-off' : 'download-cloud'}
                  size={17}
                  color="default"
                />
              )}
            </Box>
          )}
        </Box>
      </Pressable>
      {showDownloadControl && onDownloadPress && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={downloadAccessibilityLabel}
          accessibilityState={{ disabled: downloading || downloadDisabled }}
          disabled={downloading || downloadDisabled}
          onPress={onDownloadPress}
          style={{
            position: 'absolute',
            left: 0,
            top: isList ? 0 : undefined,
            bottom: isList ? 0 : 0,
            width: isList ? 54 : 44,
            height: isList ? 92 : 44,
          }}
        />
      )}
    </Box>
  )
}

export default BibleDisplayModeCard
