import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import InterlinearMark from './InterlinearMark'

/**
 * Opens the Hebrew and Greek Bible straight in its interlinear presentation, from its row in
 * the version list. Its I is the one of the reader's interlinear button.
 */
const InterlinearShortcut = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation()

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
      <Box
        className="overflow-visible border-continuous flex-row items-center gap-[7px] h-[32px] pl-[12px] pr-[14px] rounded-[16px] bg-reverse"
        style={{ boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)' }}
      >
        <InterlinearMark className="text-primary" />
        <Text className="text-[14px] font-bold text-primary">
          {t('versionSelector.openInterlinear')}
        </Text>
      </Box>
    </Pressable>
  )
}

export default InterlinearShortcut
