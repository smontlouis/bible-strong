import { StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import type {
  SourceGroupWidget as Descriptor,
  StudySource,
} from '@bible-strong/ai-contract/contract'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useAssistantSheet } from '../assistantSheetContext'
import { sourceDisplayTitle, sourceRoute } from '../sourceNavigation'
import WidgetFrame, { WidgetIconButton } from './WidgetFrame'

function SourceCard({ source }: { source: StudySource }) {
  const { t } = useTranslation(),
    navigate = usePushRouteOnce(),
    { showSource } = useAssistantSheet()
  const title = sourceDisplayTitle(source)
  return (
    <Box
      className="border-separator px-3 py-[10px]"
      style={{ borderBottomWidth: StyleSheet.hairlineWidth }}
    >
      <HStack className="items-center gap-2">
        <FeatherIcon name="file-text" size={15} color="grey" />
        <TouchableBox
          accessibilityRole="button"
          onPress={() => showSource(source)}
          className="flex-1"
        >
          <Text className="text-primary text-[14px] font-semibold" numberOfLines={2}>
            {title}
          </Text>
        </TouchableBox>
        <WidgetIconButton
          icon="arrow-up-right"
          label={t('assistant.widgets.open', { reference: title })}
          onPress={() => navigate(sourceRoute(source))}
        />
      </HStack>
      <Text className="text-grey mt-1 text-[12px]">{t('assistant.widgets.sourceExcerpt')}</Text>
      <Text className="text-[14px] leading-[22px]" numberOfLines={8}>
        {source.excerpt}
      </Text>
    </Box>
  )
}

export default function SourceGroupWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  return (
    <WidgetFrame
      title={widget.title}
      eyebrow={t(`assistant.widgets.${widget.kind}`)}
      icon="file-text"
    >
      {widget.sources.map(source => (
        <SourceCard key={source.id} source={source} />
      ))}
    </WidgetFrame>
  )
}
