import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { BookWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { formatPassageMediaDuration, getPassageMediaForBook } from '~features/bible/passageMedia'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { getBook } from '~helpers/bibleBookCatalog'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { VersionCode } from '~state/tabs'
import WidgetFrame, {
  WidgetDisclosure,
  WidgetLoading,
  WidgetNotice,
  WidgetUnavailable,
} from './WidgetFrame'

export default function BookWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    navigate = usePushRouteOnce(),
    book = getBook(widget.book)
  const [limit, setLimit] = useState(8)
  const media = getPassageMediaForBook(widget.book, widget.language)
  const query = useQuery({
    queryKey: ['assistant-book-outline', widget.version],
    queryFn: () => resources.bibleReading.loadPericope(widget.version as VersionCode),
    staleTime: 300000,
  })
  const headings = Object.entries(query.data?.[String(widget.book)] || {})
    .flatMap(([chapter, verses]) =>
      Object.entries(verses).flatMap(([verse, levels]) =>
        Object.values(levels)
          .filter((text): text is string => typeof text === 'string' && Boolean(text.trim()))
          .map(text => ({ chapter: Number(chapter), verse: Number(verse) || 1, text }))
      )
    )
    .filter(
      h =>
        Number.isInteger(h.chapter) &&
        h.chapter >= 1 &&
        h.chapter <= (book?.Chapitres || 0) &&
        Number.isInteger(h.verse) &&
        h.verse >= 1 &&
        h.verse <= 176
    )
    .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
  return (
    <WidgetFrame title={widget.title} eyebrow={t('assistant.widgets.bookOverview')}>
      <Box className="px-3 py-[10px]">
        <HStack className="items-baseline justify-between">
          <Text className="text-[16px] font-bold">{book?.Nom}</Text>
          <Text className="text-grey text-[12px]">
            {t('assistant.widgets.chapterCount', { count: book?.Chapitres || 0 })}
          </Text>
        </HStack>
        {media.length > 0 ? (
          <Box className="gap-2 py-2">
            {media.map(item => (
              <TouchableBox
                key={item.workId}
                accessibilityRole="button"
                onPress={() =>
                  navigate({
                    pathname: '/passage-media-player',
                    params: { workId: item.workId, language: widget.language },
                  })
                }
                className="bg-reverse flex-row items-center gap-3 rounded-[12px] p-3"
              >
                <FeatherIcon name="play" size={18} color="primary" />
                <Box className="flex-1">
                  <Text className="text-[14px] font-semibold" numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text className="text-grey text-[12px]">
                    {item.attributionLabel} · {formatPassageMediaDuration(item.durationSeconds)}
                  </Text>
                </Box>
                <FeatherIcon name="arrow-up-right" size={15} color="grey" />
              </TouchableBox>
            ))}
          </Box>
        ) : (
          <Box className="py-2">
            <WidgetNotice>{t('assistant.widgets.noPanorama')}</WidgetNotice>
          </Box>
        )}
        <Text className="pb-1 text-[14px] font-bold">
          {t('assistant.widgets.bookOutline')} · {widget.version}
        </Text>
        {query.isPending ? (
          <WidgetLoading />
        ) : query.isError ? (
          <WidgetUnavailable onRetry={() => void query.refetch()} />
        ) : headings.length ? (
          headings.slice(0, limit).map((h, i) => (
            <TouchableBox
              key={i}
              accessibilityRole="button"
              onPress={() =>
                navigate({
                  pathname: '/bible-view',
                  params: {
                    book: String(widget.book),
                    chapter: String(h.chapter),
                    verse: String(h.verse),
                    version: widget.version,
                  },
                })
              }
              className="flex-row gap-2 py-[6px]"
            >
              <Text className="text-grey w-[44px] text-[12px] leading-[20px]">
                {h.chapter}:{h.verse}
              </Text>
              <Text className="flex-1 text-[14px] leading-[20px]">{h.text}</Text>
            </TouchableBox>
          ))
        ) : (
          <WidgetNotice>{t('assistant.widgets.noOutline')}</WidgetNotice>
        )}
        {headings.length > limit && (
          <TouchableBox
            accessibilityRole="button"
            onPress={() => setLimit(n => n + 12)}
            className="self-start py-2"
          >
            <Text className="text-primary text-[14px] font-semibold">
              {t('assistant.widgets.more')}
            </Text>
          </TouchableBox>
        )}
        <WidgetDisclosure title={t('assistant.widgets.chapters')}>
          <HStack className="flex-wrap gap-2 pt-1">
            {Array.from({ length: book?.Chapitres || 0 }, (_, i) => (
              <TouchableBox
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${book?.Nom} ${i + 1}`}
                onPress={() =>
                  navigate({
                    pathname: '/bible-view',
                    params: {
                      book: String(widget.book),
                      chapter: String(i + 1),
                      version: widget.version,
                    },
                  })
                }
                className="bg-reverse h-[36px] w-[36px] items-center justify-center rounded-[8px]"
              >
                <Text className="text-[13px]">{i + 1}</Text>
              </TouchableBox>
            ))}
          </HStack>
        </WidgetDisclosure>
      </Box>
    </WidgetFrame>
  )
}
