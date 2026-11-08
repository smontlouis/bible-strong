import { useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { PassageTarget, PassageWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { colorWithOpacity, resolveThemeColor } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { loadWidgetPassage } from './passageData'

/** Verses shown before « Afficher la suite » in a long passage. */
const SHOWN_VERSES = 3
/** Passages shown before the rest of a list. */
const SHOWN_PASSAGES = 3

const verseNumbers = (p: PassageTarget) =>
  Array.from({ length: p.end - p.start + 1 }, (_, i) => p.start + i)

/**
 * One passage quoted in the flow of the answer, as a reader quotes a verse: its text in a
 * tinted block, then its reference. The text comes from the Bible, never from the model; the
 * block opens the passage in the Bible.
 */
function VerseQuote({ passage }: { passage: PassageTarget }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const resources = useResourceAccess()
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
  return (
    <TouchableBox
      accessibilityRole="button"
      accessibilityLabel={t('assistant.widgets.open', { reference: label })}
      onPress={open}
      className="my-2 rounded-[12px] px-4 pb-[10px] pt-3"
      style={{
        backgroundColor: colorWithOpacity(resolveThemeColor(theme, 'primary'), 0.1),
      }}
    >
      {query.isPending ? (
        <Box className="min-h-[25px] items-start justify-center">
          <ActivityIndicator size="small" color={theme.colors.grey} />
        </Box>
      ) : query.isError ? (
        <Text className="text-grey text-[15px] leading-[23px]">
          {t('assistant.widgets.unavailable')}
        </Text>
      ) : (
        <Text className="text-[16px] leading-[25px]">
          {shown.map((verse, index) => (
            <Text key={verse.number} className="text-[16px] leading-[25px]">
              {numbered && <Text className="text-grey text-[11px]">{verse.number} </Text>}
              {verse.text.trim()}
              {index < shown.length - 1 ? ' ' : ''}
            </Text>
          ))}
          {shown.length < verses.length ? ' …' : ''}
        </Text>
      )}
      <Box className="mt-[6px] flex-row items-center justify-between gap-3">
        <Text className="text-link text-[13px] font-semibold" numberOfLines={1}>
          {label} · {passage.version}
        </Text>
        {verses.length > SHOWN_VERSES && (
          <TouchableBox
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setExpanded(value => !value)}
          >
            <Text className="text-link text-[13px]">
              {expanded ? t('assistant.widgets.less') : t('assistant.widgets.more')}
            </Text>
          </TouchableBox>
        )}
      </Box>
    </TouchableBox>
  )
}

/**
 * Passages placed in an answer (a verse card, a passage list, parallel passages): quotes in
 * the flow of the text rather than a framed card (2026-11-08).
 */
export default function VerseQuoteWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  const [all, setAll] = useState(false)
  const list = widget.passages.length > 1
  const shown = all ? widget.passages : widget.passages.slice(0, SHOWN_PASSAGES)
  return (
    <Box className="my-1">
      {list && <Text className="text-grey mt-1 text-[13px]">{widget.title}</Text>}
      {shown.map((passage, index) => (
        <VerseQuote
          key={`${passage.version}:${passage.book}:${passage.chapter}:${passage.start}:${passage.end}:${index}`}
          passage={passage}
        />
      ))}
      {widget.passages.length > shown.length && (
        <TouchableBox
          accessibilityRole="button"
          onPress={() => setAll(true)}
          className="self-start py-1"
        >
          <Text className="text-link text-[14px]">
            {t('assistant.widgets.morePassages', { count: widget.passages.length - shown.length })}
          </Text>
        </TouchableBox>
      )}
    </Box>
  )
}
