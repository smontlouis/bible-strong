import { ScrollView } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Checkbox from '~common/ui/Checkbox'
import Switch from './InlineCommentarySwitch'
import { useTheme } from '~themes/ThemeProvider'
import type { RootState } from '~redux/modules/reducer'
import {
  setSettingsInlineCommentaries,
  setSettingsInlineCommentariesEnabled,
} from '~redux/modules/user'
import { parseCommentaryProjectionId } from './commentarySelection'
import {
  isInlineCommentaryEligible,
  normalizeInlineCommentaries,
} from './inlineCommentarySelection'

export default function InlineCommentarySettings({ onManage }: { onManage?: () => void }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { colors } = useTheme()
  const settings = useSelector((state: RootState) => state.user.bible.settings)
  const eligibleSelection = settings.commentarySelection.filter(isInlineCommentaryEligible)
  const enabled = normalizeInlineCommentaries(
    settings.inlineCommentaries,
    settings.commentarySelection
  )
  return (
    <>
      <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
        <HStack className="p-[16px] items-center justify-between gap-[12px]">
          <Text>{t('inlineCommentary.enabled')}</Text>
          <Switch
            accessibilityLabel={t('inlineCommentary.title')}
            value={settings.inlineCommentariesEnabled ?? enabled.length > 0}
            onValueChange={value => {
              dispatch(setSettingsInlineCommentariesEnabled(value))
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            ios_backgroundColor={colors.border}
            thumbColor="#ffffff"
          />
        </HStack>
        {eligibleSelection.map(id => {
          const projection = parseCommentaryProjectionId(id)
          const entry = projection ? COMMENTARY_CATALOG_BY_ID.get(projection.resourceId) : undefined
          if (!projection || !entry) return null
          const checked = enabled.includes(id)
          return (
            <HStack key={id} className="items-center">
              <TouchableBox
                accessibilityRole="checkbox"
                accessibilityLabel={entry.title}
                accessibilityState={{ checked }}
                onPress={() =>
                  dispatch(
                    setSettingsInlineCommentaries(
                      checked ? enabled.filter(value => value !== id) : [...enabled, id]
                    )
                  )
                }
                className="flex-1 flex-row items-center gap-[12px] p-[16px] rounded-lg hover:bg-light-grey"
              >
                <Checkbox checked={checked} />
                <Box className="flex-1 gap-[4px]">
                  <Text className="text-[14px]">
                    {entry.shortName} · {projection.language.toUpperCase()}
                  </Text>
                </Box>
              </TouchableBox>
            </HStack>
          )
        })}
        {!eligibleSelection.length && (
          <Box className="p-[16px] gap-[12px]">
            <Text className="text-grey">{t('inlineCommentary.noSelection')}</Text>
            {onManage && (
              <TouchableBox accessibilityRole="button" onPress={onManage}>
                <Text className="text-primary font-semibold">
                  {t('commentaries.selector.title')}
                </Text>
              </TouchableBox>
            )}
          </Box>
        )}
      </ScrollView>
    </>
  )
}

export function InlineCommentaryManageAction({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation()
  return (
    <TouchableBox
      accessibilityRole="button"
      onPress={onPress}
      className="px-[8px] min-h-[44px] justify-center"
    >
      <Text className="text-primary font-semibold text-[14px]">
        {t('commentaries.availability.manage')}
      </Text>
    </TouchableBox>
  )
}
