import { twMerge } from '~common/ui/classNames'
import { resolveThemeColor, colorWithOpacity } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
  const stylingTheme = useStylingTheme()

  const isList = layout === 'list'
  const showDownloadControl = downloadRequired || downloading
  const interactionDisabled = disabled || downloading || downloadRequired

  return (
    <Box
      className="overflow-hidden border-continuous relative"
      style={{ height: isList ? 92 : 148, flex: isList ? undefined : 1 }}
    >
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
          className={twMerge(
            'overflow-hidden border-continuous',
            twMerge(
              isList ? 'border-border' : selected ? 'border-primary' : 'border-border',
              'overflow-hidden border-continuous rounded-[16px]'
            )
          )}
          style={{
            padding: isList ? 16 : 12,
            height: isList ? 92 : 148,
            borderWidth: isList ? 1 : selected ? 2 : 1,
            alignItems: isList ? 'center' : undefined,
            gap: isList ? 12 : undefined,
            backgroundColor: colorWithOpacity(
              resolveThemeColor(
                stylingTheme,
                isList ? 'reverse' : selected ? 'lightPrimary' : 'reverse'
              ),
              0.5
            ),
            flexDirection: isList ? 'row' : 'column',
            opacity: disabled || downloadRequired ? 0.5 : 1,
          }}
        >
          {isList &&
            (showDownloadControl ? (
              <Box
                className="overflow-hidden border-continuous w-[22px] h-[22px] items-center justify-center"
                pointerEvents="none"
              >
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
          <Box
            className="overflow-hidden border-continuous"
            style={{
              flex: isList ? 1.15 : undefined,
              justifyContent: isList ? 'center' : undefined,
            }}
          >
            <Text
              className={twMerge(selected ? 'text-primary' : 'text-default', 'font-bold')}
              numberOfLines={isList ? 2 : 1}
              style={{
                fontSize: isList ? 14 : 15,
                textAlign: isList ? 'left' : 'center',
                lineHeight: isList ? 17 : undefined,
              }}
            >
              {label}
            </Text>
            {isList && (
              <Text className="text-[10px] text-tertiary leading-[13px] mt-[2px]" numberOfLines={2}>
                {description}
              </Text>
            )}
          </Box>
          <Box
            className="overflow-hidden border-continuous flex-[1]"
            style={{
              alignItems: isList ? 'flex-end' : undefined,
              justifyContent: !isList ? 'center' : undefined,
            }}
          >
            {children}
          </Box>
          {!isList && (
            <Text
              className="text-[11px] text-tertiary text-center"
              numberOfLines={1}
              style={{ paddingHorizontal: showDownloadControl ? 28 : 0 }}
            >
              {description}
            </Text>
          )}
          {showDownloadControl && !isList && (
            <Box
              className="overflow-hidden border-continuous absolute bottom-[0px] left-[0px] w-[44px] h-[44px] items-center justify-center"
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
