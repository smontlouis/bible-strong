import { useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { LexicalWidget } from '@bible-strong/ai-contract/contract'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ConcordanceVerse from '~features/bible/ConcordanceVerse'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { getBook } from '~helpers/bibleBookCatalog'
import { resolveStrongNavigationVersionId } from '~helpers/strongBiblePublications'
import { getStrongReferenceNumber } from '~helpers/strongIdentities'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import WidgetFrame, { WidgetLoading, WidgetNotice, WidgetUnavailable } from './WidgetFrame'
import WidgetSelect from './WidgetSelect'

export default function ConcordanceWidget({ widget }: { widget: LexicalWidget }) {
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    navigate = usePushRouteOnce()
  const [book, setBook] = useState(0)
  const requestedVersion = widget.version || 'LSG'
  const indexedVersion = resolveStrongNavigationVersionId(requestedVersion)
  const base = {
    currentVersionId: requestedVersion,
    defaultVersionId: indexedVersion || 'LSG',
    reference: widget.reference,
    book: widget.reference.startsWith('G') ? 40 : 1,
    allBooks: true,
  }
  const counts = useQuery({
    queryKey: ['assistant-concordance-counts', widget.reference, widget.scope, requestedVersion],
    queryFn: async () => {
      if (!indexedVersion) throw new Error('UNSUPPORTED_INDEX')
      const r = await resources.strongBible.loadCountsByBook(base)
      if (r.status !== 'available' || r.provenance.versionId !== requestedVersion)
        throw new Error('UNAVAILABLE')
      return r
    },
    staleTime: 300000,
  })
  const query = useInfiniteQuery({
    queryKey: ['assistant-concordance', widget.reference, widget.scope, requestedVersion, book],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!indexedVersion) throw new Error('UNSUPPORTED_INDEX')
      const r = await resources.strongBible.loadFoundVersesByBook({
        ...base,
        book: book || base.book,
        allBooks: book === 0,
        limit: 5,
        pageToken: pageParam,
      })
      if (r.status !== 'available' || r.provenance.versionId !== requestedVersion)
        throw new Error('UNAVAILABLE')
      const norm = (s: string) => s.replace(/^([GH])0+/, '$1').toUpperCase()
      if (r.identity && norm(r.identity.code) !== norm(widget.reference))
        throw new Error('IDENTITY_MISMATCH')
      return r
    },
    getNextPageParam: last => last.nextPageToken,
    staleTime: 300000,
  })
  const verses = query.data?.pages.flatMap(page => page.verses) || []
  const total = counts.data?.counts
    .filter(c => !book || c.Livre === book)
    .reduce((n, c) => n + c.versesCountByBook, 0)
  const version =
    query.data?.pages[0]?.provenance.versionId || counts.data?.provenance.versionId || 'LSG'
  const bookItems = [
    { id: '0', label: t('assistant.widgets.allBooks') },
    ...(counts.data?.counts.map(c => ({
      id: String(c.Livre),
      label: `${getBook(c.Livre)?.Nom} (${c.versesCountByBook})`,
    })) || []),
  ]
  return (
    <WidgetFrame title={widget.reference} eyebrow={t('assistant.widgets.concordance')} icon="list">
      <Box className="px-3 py-[10px]">
        <HStack className="items-center justify-between gap-2 pb-1">
          <Text className="text-grey shrink text-[12px]">
            {version} ·{' '}
            {total === undefined ? '…' : t('assistant.widgets.verseCount', { count: total })}
          </Text>
          <WidgetSelect
            label={t('assistant.widgets.bookFilter')}
            value={String(book)}
            items={bookItems}
            onChange={value => setBook(Number(value))}
          />
        </HStack>
        {query.isPending ? (
          <WidgetLoading />
        ) : query.isError ? (
          <WidgetUnavailable onRetry={() => void query.refetch()} />
        ) : !verses.length ? (
          <WidgetNotice>{t('assistant.widgets.noVerses')}</WidgetNotice>
        ) : (
          verses.map((verse, index) => {
            const b = Number(verse.Livre),
              c = Number(verse.Chapitre),
              v = Number(verse.Verset)
            return (
              <ConcordanceVerse
                key={`${b}:${c}:${v}:${index}`}
                verse={verse}
                t={t}
                concordanceFor={getStrongReferenceNumber(widget.reference) || widget.reference}
                textStyle={{ fontSize: 14, lineHeight: 24 }}
                referenceTextStyle={{ fontSize: 12, lineHeight: 18, fontWeight: '600' }}
                onOpenVerse={() =>
                  navigate({
                    pathname: '/bible-view',
                    params: {
                      book: String(b),
                      chapter: String(c),
                      verse: String(v),
                      version,
                      focusVerses: JSON.stringify([v]),
                      contextDisplayMode: 'focused',
                    },
                  })
                }
              />
            )
          })
        )}
        {query.hasNextPage && (
          <TouchableBox
            accessibilityRole="button"
            disabled={query.isFetchingNextPage}
            onPress={() => void query.fetchNextPage()}
            className="self-start py-2"
          >
            <Text className="text-link text-[14px] font-semibold">
              {t(query.isFetchingNextPage ? 'Chargement...' : 'assistant.widgets.more')}
            </Text>
          </TouchableBox>
        )}
      </Box>
    </WidgetFrame>
  )
}
