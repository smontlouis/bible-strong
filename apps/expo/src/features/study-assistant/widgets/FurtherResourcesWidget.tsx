import { useTranslation } from 'react-i18next'
import type { FurtherResourcesWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { formatPassageMediaDuration, getPassageMediaById } from '~features/bible/passageMedia'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { suggestionRoute } from './suggestionRoute'
import WidgetFrame, { WidgetNotice } from './WidgetFrame'

export default function FurtherResourcesWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation(),
    navigate = usePushRouteOnce()
  return (
    <WidgetFrame
      title={widget.title}
      eyebrow={t('assistant.widgets.furtherResources')}
      icon="bookmark"
    >
      {!!widget.unavailable?.length && (
        <Box className="px-3 pt-[10px]">
          <WidgetNotice>{t('assistant.widgets.partialResources')}</WidgetNotice>
        </Box>
      )}
      {!widget.items.length ? (
        <Box className="px-3 py-[10px]">
          <WidgetNotice>
            {t(
              widget.unavailable?.length
                ? 'assistant.widgets.resourceUnavailable'
                : 'assistant.widgets.noResources'
            )}
          </WidgetNotice>
        </Box>
      ) : (
        widget.items.map((item, index) => {
          const media =
            item.kind === 'media' ? getPassageMediaById(item.id, item.language) : undefined
          const missing = item.kind === 'media' && !media
          return (
            <TouchableBox
              key={`${item.kind}:${item.id}:${index}`}
              accessibilityRole="button"
              disabled={missing}
              onPress={() => navigate(suggestionRoute(item))}
              className="border-border flex-row items-center gap-3 border-b px-3 py-[10px]"
              style={{ opacity: missing ? 0.5 : 1 }}
            >
              <FeatherIcon
                name={item.kind === 'media' ? 'video' : 'book-open'}
                size={18}
                color="primary"
              />
              <Box className="flex-1">
                <Text className="text-[14px] font-semibold" numberOfLines={2}>
                  {media?.title || item.label}
                </Text>
                <Text className="text-grey text-[12px]">
                  {t(`assistant.widgets.resourceKind.${item.kind}`)} · {item.language.toUpperCase()}
                  {media ? ` · ${formatPassageMediaDuration(media.durationSeconds)}` : ''}
                  {missing ? ` · ${t('assistant.widgets.resourceUnavailable')}` : ''}
                </Text>
              </Box>
              <FeatherIcon name="arrow-up-right" size={15} color="grey" />
            </TouchableBox>
          )
        })
      )}
    </WidgetFrame>
  )
}
