import { useTranslation } from 'react-i18next'
import type { NaveWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ResourcePreviewContent from '~features/bibleReferencePreview/ResourcePreviewContent'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import WidgetFrame, { WidgetOpenButton } from './WidgetFrame'

export default function NaveWidget({ widget }: { widget: Descriptor }) {
  const { fontFamily } = useTheme()
  const { t } = useTranslation(),
    navigate = usePushRouteOnce()
  return (
    <WidgetFrame title={widget.title} eyebrow={t('assistant.widgets.nave')} icon="layers">
      <Box className="px-3 pt-[10px]">
        <ResourcePreviewContent
          typography={{
            fontFamily: resolveFontFamily(fontFamily.text) || 'sans-serif',
            fontSize: 14,
            lineHeight: 24,
          }}
          target={{
            kind: 'nave',
            name: widget.topic,
            title: widget.title,
            source: { kind: 'nave', language: widget.language },
          }}
        />
      </Box>
      <HStack className="border-border items-center justify-between border-t px-3 py-2">
        <Text className="text-grey text-[12px]">Nave · {widget.language.toUpperCase()}</Text>
        <WidgetOpenButton
          label={t('assistant.widgets.openTopic')}
          onPress={() =>
            navigate({
              pathname: '/nave-detail',
              params: { name: widget.topic, name_lower: widget.topic, language: widget.language },
            })
          }
        />
      </HStack>
    </WidgetFrame>
  )
}
