import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { StudySource } from '@bible-strong/ai-contract/contract'
import Sheet from '~common/ModalSheet'
import { SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useAssistantSheet } from './assistantSheetContext'
import { sourceDisplayTitle, sourceRoute } from './sourceNavigation'

/** The passage an answer cites, read in place before deciding to open the resource. */
export default function SourceExcerptSheet({
  source,
  onClose,
}: {
  source: StudySource | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { navigate } = useAssistantSheet()
  const sheet = useRef<SheetRef>(null)
  useEffect(() => {
    if (source) sheet.current?.present()
  }, [source])
  return (
    <Sheet
      ref={sheet}
      snapPoints={[0.5, 1]}
      onDismiss={onClose}
      header={
        <SheetHeader
          title={source ? sourceDisplayTitle(source) : ''}
          rightComponent={
            <TouchableBox
              accessibilityRole="button"
              accessibilityLabel={t('assistant.sources.open')}
              onPress={() => source && navigate(sourceRoute(source))}
              className="h-[54px] w-[54px] items-center justify-center"
            >
              <FeatherIcon name="external-link" size={18} color="primary" />
            </TouchableBox>
          }
        />
      }
    >
      <SheetScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text selectable className="text-[16px] leading-[26px]">
          {source?.excerpt}
        </Text>
      </SheetScrollView>
    </Sheet>
  )
}
