import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { PassageTarget, PassageWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import { getScaledStrongTextStyle } from '~features/lexique/strongEditorialHtmlStyles'
import { useStrongReadingTypography } from '~features/lexique/useStrongReadingTypography'
import { useResourceAccess } from '~features/resources/resourceAccess'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTheme } from '~themes/ThemeProvider'
import { loadWidgetPassage } from './passageData'
import { QuoteBlock, QuoteLoading, QuoteMore } from './QuoteBlock.web'

/** Verses shown before « Afficher la suite » in a long passage. */
const SHOWN_VERSES = 3
/** Passages shown before the rest of a list. */
const SHOWN_PASSAGES = 3

const verseNumbers = (p: PassageTarget) =>
  Array.from({ length: p.end - p.start + 1 }, (_, i) => p.start + i)

/**
 * One passage quoted in the flow of the answer, as on the phone: a rule, its text in the
 * reading font, then its reference. The text comes from the Bible, never from the model; the
 * quote opens the passage in the Bible.
 */
function VerseQuote({ passage }: { passage: PassageTarget }) {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const reading = useStrongReadingTypography()
  const navigate = usePushRouteOnce()
  const [expanded, setExpanded] = useState(false)
  const label = verseToReference({
    bookNum: passage.book,
    chapterNum: passage.chapter,
    verses: verseNumbers(passage),
  })
  const query = useQuery({
    queryKey: [
      'assistant-widget-passage',
      passage.version,
      passage.book,
      passage.chapter,
      passage.start,
      passage.end,
    ],
    queryFn: ({ signal }) => loadWidgetPassage(passage, resources.bibleContent, signal),
    staleTime: 300000,
  })
  const open = () =>
    navigate({
      pathname: '/bible-view',
      params: {
        book: String(passage.book),
        chapter: String(passage.chapter),
        verse: String(passage.start),
        focusVerses: JSON.stringify(verseNumbers(passage)),
        version: passage.version,
        contextDisplayMode: 'focused',
      },
    })
  const verses = query.data || []
  const shown = expanded ? verses : verses.slice(0, SHOWN_VERSES)
  const numbered = verses.length > 1
  // A unitless line height is a multiple of the size in CSS, so both are given in pixels.
  const scaled = getScaledStrongTextStyle(17, 27, reading)
  const verseStyle = {
    fontFamily: scaled.fontFamily,
    fontSize: `${scaled.fontSize}px`,
    lineHeight: `${scaled.lineHeight}px`,
  }
  return (
    <QuoteBlock
      mark="bible"
      foot={`${label} · ${passage.version}`}
      onPress={open}
      aside={
        verses.length > SHOWN_VERSES && (
          <button
            type="button"
            className="bs-quote-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded(value => !value)}
          >
            {expanded ? t('assistant.widgets.less') : t('assistant.widgets.more')}
          </button>
        )
      }
    >
      {query.isPending ? (
        <QuoteLoading label={t('Chargement...')} />
      ) : query.isError ? (
        <p className="bs-quote-muted">{t('assistant.widgets.unavailable')}</p>
      ) : (
        <p className="bs-quote-verse" style={verseStyle}>
          {shown.map((verse, index) => (
            <span key={verse.number}>
              {numbered && <sup>{verse.number}</sup>}
              {verse.text.trim()}
              {index < shown.length - 1 ? ' ' : ''}
            </span>
          ))}
          {shown.length < verses.length ? ' …' : ''}
        </p>
      )}
    </QuoteBlock>
  )
}

/**
 * Passages placed in an answer (a verse card, a passage list, parallel passages): quotes in the
 * flow of the text rather than a framed card, as on the phone (2026-11-08).
 */
export default function VerseQuoteWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const [all, setAll] = useState(false)
  const list = widget.passages.length > 1
  const shown = all ? widget.passages : widget.passages.slice(0, SHOWN_PASSAGES)
  return (
    <div className="bs-quote-group">
      {list && (
        <p className="bs-quote-title" style={{ color: colors.grey }}>
          {widget.title}
        </p>
      )}
      {shown.map((passage, index) => (
        <VerseQuote
          key={`${passage.version}:${passage.book}:${passage.chapter}:${passage.start}:${passage.end}:${index}`}
          passage={passage}
        />
      ))}
      {widget.passages.length > shown.length && (
        <QuoteMore
          label={t('assistant.widgets.morePassages', {
            count: widget.passages.length - shown.length,
          })}
          onPress={() => setAll(true)}
        />
      )}
    </div>
  )
}
