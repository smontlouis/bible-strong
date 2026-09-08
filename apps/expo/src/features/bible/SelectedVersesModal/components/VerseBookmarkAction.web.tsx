import { useTranslation } from 'react-i18next'
import ContextualPanel from '~common/ContextualPanel'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useTheme } from '~themes/ThemeProvider'
import { useBibleBookmarkScreens } from '~features/bookmarks/useBibleBookmarkScreens'
import { getSelectedVersesBookmarkLocation } from '~features/bible/selectedVersesActions'
import { ACTION_ITEM_WIDTH, ICON_BOX_SIZE, ICON_SIZE } from '../constants'
import ActionItem from './ActionItem'
import type { VerseBookmarkActionProps } from './VerseBookmarkAction'

export default function VerseBookmarkAction({
  selectedVerses,
  version,
  disabled,
  isActive,
  onPress,
}: VerseBookmarkActionProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const location = getSelectedVersesBookmarkLocation(selectedVerses)
  const panel = useBibleBookmarkScreens(
    location?.book ?? 1,
    location?.chapter ?? 1,
    version,
    location?.verse
  )
  if (disabled || !location)
    return (
      <ActionItem
        name="bookmark"
        label={t('Marque-page')}
        onPress={onPress}
        disabled
        isActive={isActive}
      />
    )
  return (
    <ContextualPanel
      accessibilityLabel={t('Marque-page')}
      initialScreen="bookmark"
      width={430}
      screens={panel.screens}
      onOpen={panel.prepare}
      trigger={
        <Box className="items-center py-2 gap-2" style={{ width: ACTION_ITEM_WIDTH }}>
          <Box
            className="items-center justify-center bg-light-grey rounded-[16px]"
            style={{
              width: ICON_BOX_SIZE,
              height: ICON_BOX_SIZE,
              ...(isActive ? { boxShadow: `inset 0 0 0 2px ${theme.colors.primary}` } : {}),
            }}
          >
            <FeatherIcon name="bookmark" size={ICON_SIZE} color="primary" />
          </Box>
          <Text className="text-[10px] text-center">{t('Marque-page')}</Text>
        </Box>
      }
    />
  )
}
