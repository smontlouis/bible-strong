import { useTranslation } from 'react-i18next'
import { ArrowUpRightIcon, CalendarDaysIcon } from 'lucide-react'
import type { ReadingWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import { useReadingContent } from '~features/daily-reading/useDailyMeditation'
import { getEditorialKind, getMeditationTitle } from '~features/plans/readingCalendar'
import ReferenceParagraph from '~features/plans/PlanSliceScreen/ReferenceParagraph'
import { chapterToReference } from '~helpers/chapterToReference'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import WidgetFrame from './WidgetFrame.web'
export default function ReadingWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation(),
    { collection, isError, retry } = useReadingContent(widget.planId),
    navigate = usePushRouteOnce(),
    { fontFamily, colors } = useTheme()
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
      icon={<CalendarDaysIcon size={17} />}
    >
      <div className="bs-widget-reading">
        {!collection && !isError ? (
          <p role="status">{t('Chargement...')}</p>
        ) : !reading || !compatible ? (
          <div className="bs-widget-unavailable">
            <p>{t('assistant.widgets.resourceUnavailable')}</p>
            <button type="button" onClick={() => void retry()}>
              {t('assistant.errors.retry')}
            </button>
          </div>
        ) : (
          <>
            <small className="bs-widget-reading-credit">
              {collection.title} · {collection.author.displayName}
            </small>
            <div className="bs-widget-reading-body">
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
                    style={{
                      fontFamily: resolveFontFamily(fontFamily.text),
                      fontSize: 14,
                      color: colors.default,
                      lineHeight: 24,
                    }}
                  >
                    {text}
                  </ReferenceParagraph>
                ) : null
              })}
            </div>
            <button
              type="button"
              className="bs-widget-resource-open"
              onClick={() =>
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
            >
              {t('assistant.widgets.openReading')}
              <ArrowUpRightIcon size={15} />
            </button>
          </>
        )}
        {widget.reflection && (
          <aside className="bs-widget-analysis">
            <small>{t('assistant.widgets.reflection')}</small>
            <p>{widget.reflection}</p>
          </aside>
        )}
      </div>
    </WidgetFrame>
  )
}
