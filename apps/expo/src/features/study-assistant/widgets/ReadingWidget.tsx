import { useTranslation } from 'react-i18next'
import type { ReadingWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useReadingContent } from '~features/daily-reading/useDailyMeditation'
import ReferenceParagraph from '~features/plans/PlanSliceScreen/ReferenceParagraph'
import { getEditorialKind, getMeditationTitle } from '~features/plans/readingCalendar'
import { chapterToReference } from '~helpers/chapterToReference'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTheme } from '~themes/ThemeProvider'
import WidgetFrame, { WidgetLoading, WidgetOpenButton, WidgetUnavailable } from './WidgetFrame'

export default function ReadingWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation(),
    { collection, isError, retry } = useReadingContent(widget.planId),
    navigate = usePushRouteOnce(),
    { colors } = useTheme()
  const reading = collection?.sections
    .flatMap(section => section.readingSlices)
    .find(item => item.id === widget.readingId)
  const compatible =
    collection &&
    (getEditorialKind(collection) === 'daily-meditation') === (widget.kind === 'meditation')
  return (
    <WidgetFrame
      title={reading ? getMeditationTitle(reading) || widget.title : widget.title}
      eyebrow={t(`assistant.widgets.${widget.kind}`)}
      icon="calendar"
    >
      <Box className="px-3 py-[10px]">
        {!collection && !isError ? (
          <WidgetLoading />
        ) : !reading || !compatible ? (
          <WidgetUnavailable onRetry={() => void retry()} />
        ) : (
          <>
            <Text className="text-grey pb-2 text-[12px]">
              {collection.title} · {collection.author.displayName}
            </Text>
            <Box className="gap-2">
              {reading.slices.map((slice, i) => {
                const text =
                  slice.type === 'Text'
                    ? slice.description
                    : slice.type === 'Title'
                      ? slice.title
                      : slice.type === 'Chapter'
                        ? chapterToReference(slice.chapters)
                        : slice.type === 'Verse'
                          ? verseToReference(slice.verses, { isPlan: true })
                          : slice.type === 'Video'
                            ? `${t('assistant.widgets.video')}: ${slice.title}`
                            : slice.type === 'Image'
                              ? slice.alt || ''
                              : ''
                return text ? (
                  <ReferenceParagraph
                    key={i}
                    planLanguage={collection.lang}
                    style={{ fontSize: 14, color: colors.default, lineHeight: 24 }}
                  >
                    {text}
                  </ReferenceParagraph>
                ) : null
              })}
            </Box>
            <Box className="pt-2">
              <WidgetOpenButton
                label={t('assistant.widgets.openReading')}
                onPress={() =>
                  navigate(
                    widget.kind === 'meditation'
                      ? {
                          pathname: '/meditation',
                          params: { collectionId: widget.planId, readingId: widget.readingId },
                        }
                      : {
                          pathname: '/plan-slice',
                          params: { planId: widget.planId, readingSliceId: widget.readingId },
                        }
                  )
                }
              />
            </Box>
          </>
        )}
        {!!widget.reflection && (
          <Box className="border-border mt-2 border-t pt-2">
            <Text className="text-grey text-[11px] font-semibold uppercase">
              {t('assistant.widgets.reflection')}
            </Text>
            <Text className="text-[14px] leading-[22px]">{widget.reflection}</Text>
          </Box>
        )}
      </Box>
    </WidgetFrame>
  )
}
