import { useEffect, useRef, useState } from 'react'
import { Platform, ScrollView } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Checkbox from '~common/ui/Checkbox'
import { FeatherIcon } from '~common/ui/Icon'
import type { SheetRef } from '~common/sheet'
import type { RootState } from '~redux/modules/reducer'
import { setSettingsInlineCommentaries } from '~redux/modules/user'
import { useIsOfflineResourceInstalled } from '~features/resources/useOfflineResourceRegistry'
import { parseCommentaryProjectionId } from './commentarySelection'
import {
  isInlineCommentaryEligible,
  normalizeInlineCommentaries,
} from './inlineCommentarySelection'
import CommentaryOfflineDetailsSheet from './CommentaryOfflineDetailsSheet'

function Availability({ resourceId, language }: { resourceId: string; language: 'fr' | 'en' }) {
  const installed = useIsOfflineResourceInstalled({ kind: 'commentary', resourceId, language })
  const { t } = useTranslation()
  return (
    <Text className="text-[12px] text-tertiary">
      {t(installed ? 'inlineCommentary.offlineReady' : 'inlineCommentary.onlineOnly')}
    </Text>
  )
}

export default function InlineCommentarySettings() {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const settings = useSelector((state: RootState) => state.user.bible.settings)
  const eligibleSelection = settings.commentarySelection.filter(isInlineCommentaryEligible)
  const enabled = normalizeInlineCommentaries(
    settings.inlineCommentaries,
    settings.commentarySelection
  )
  const sheet = useRef<SheetRef>(null)
  const [downloadId, setDownloadId] = useState<string>()
  useEffect(() => {
    if (downloadId) sheet.current?.present()
  }, [downloadId])
  const selectedDownload = downloadId ? parseCommentaryProjectionId(downloadId) : undefined
  const downloadEntry = selectedDownload
    ? COMMENTARY_CATALOG_BY_ID.get(selectedDownload.resourceId)
    : undefined
  return (
    <>
      <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
        <Text className="p-[16px] text-grey text-[13px]">{t('inlineCommentary.description')}</Text>
        <TouchableBox
          accessibilityRole="button"
          onPress={() => dispatch(setSettingsInlineCommentaries([]))}
          className="p-[16px] flex-row items-center gap-[12px]"
        >
          <Checkbox checked={!enabled.length} />
          <Text>{t('Désactivé')}</Text>
        </TouchableBox>
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
                  <Availability resourceId={entry.publicationId} language={projection.language} />
                </Box>
              </TouchableBox>
              {Platform.OS !== 'web' && (
                <TouchableBox
                  className="p-[16px]"
                  accessibilityRole="button"
                  accessibilityLabel={t('inlineCommentary.download')}
                  onPress={() => {
                    setDownloadId(id)
                    if (downloadId === id) sheet.current?.present()
                  }}
                >
                  <FeatherIcon name="download" size={18} color="primary" />
                </TouchableBox>
              )}
            </HStack>
          )
        })}
        {!eligibleSelection.length && (
          <Text className="p-[16px] text-grey">{t('inlineCommentary.noSelection')}</Text>
        )}
      </ScrollView>
      <CommentaryOfflineDetailsSheet
        sheetRef={sheet}
        projection={
          downloadEntry && selectedDownload
            ? { entry: downloadEntry, language: selectedDownload.language }
            : undefined
        }
      />
    </>
  )
}
