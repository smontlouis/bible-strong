import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import InterlinearMark from './InterlinearMark'

/**
 * Opens the Hebrew and Greek Bible straight in its interlinear presentation, from its row in
 * the version list. Its I is the one of the reader's interlinear button.
 */
const InterlinearShortcut = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('versionSelector.openInterlinear')}
      hitSlop={6}
      onPress={event => {
        // The row behind it opens the plain text
        event.stopPropagation()
        onPress()
      }}
      style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.72 : 1 })}
    >
      {/* A pill in the row, tinted with its colour: it does not float, so no shadow. */}
      <Box
        className="overflow-hidden border-continuous flex-row items-center gap-[7px] h-[32px] pl-[12px] pr-[14px] rounded-full"
        style={{ backgroundColor: colorWithOpacity(theme.colors.primary, 0.12) }}
      >
        <InterlinearMark className="text-link" />
        <Text className="text-[14px] font-bold text-link">
          {t('versionSelector.openInterlinear')}
        </Text>
      </Box>
    </Pressable>
  )
}

export default InterlinearShortcut
