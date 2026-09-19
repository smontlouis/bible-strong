import ConcordanceVerse from '~features/bible/ConcordanceVerse'
import { getStrongReferenceNumber } from '~helpers/strongIdentities'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { resolveStrongNavigationVersionId } from '~helpers/strongBiblePublications'
import { useState } from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai'
import type { LexicalWidget } from '@bible-strong/ai-contract/contract'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { getBook } from '~helpers/bibleBookCatalog'
import verseToReference from '~helpers/verseToReference'
import { previewHistoryAtom } from '~features/bibleReferencePreview/state'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import WidgetFrame from './WidgetFrame.web'
import WidgetSelect from './WidgetSelect.web'
export default function ConcordanceWidget({ widget }: { widget: LexicalWidget }) {
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    setPreview = useSetAtom(previewHistoryAtom),
    navigate = usePushRouteOnce()
  const { fontFamily } = useTheme()
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
  const body = (
    <div className="bs-widget-concordance">
      <div className="bs-widget-concordance-toolbar">
        <small>
          {version} ·{' '}
          {total === undefined ? '…' : t('assistant.widgets.verseCount', { count: total })}
        </small>
        <WidgetSelect
          className="bs-widget-book-select"
          label={t('assistant.widgets.bookFilter')}
          value={String(book)}
          items={bookItems}
          popoverMinWidth={210}
          onChange={value => setBook(Number(value))}
        />
      </div>
      {query.isPending ? (
        <p role="status">{t('Chargement...')}</p>
      ) : query.isError ? (
        <div className="bs-widget-unavailable">
          <p>{t('assistant.widgets.resourceUnavailable')}</p>
          <button type="button" onClick={() => void query.refetch()}>
            {t('assistant.errors.retry')}
          </button>
        </div>
      ) : !verses.length ? (
        <p>{t('assistant.widgets.noVerses')}</p>
      ) : (
        <ol className="bs-widget-shared-concordance">
          {verses.map((verse, index) => {
            const b = Number(verse.Livre),
              c = Number(verse.Chapitre),
              v = Number(verse.Verset),
              label = verseToReference({ bookNum: b, chapterNum: c, verses: [v] })
            return (
              <li key={`${b}:${c}:${v}:${index}`}>
                <ConcordanceVerse
                  verse={verse}
                  t={t}
                  concordanceFor={getStrongReferenceNumber(widget.reference) || widget.reference}
                  textStyle={{
                    fontFamily: resolveFontFamily(fontFamily.text),
                    fontSize: 14,
                    lineHeight: 24,
                  }}
                  referenceTextStyle={{ fontSize: 12, lineHeight: 18, fontWeight: '600' }}
                  onOpenVerse={() =>
                    setPreview([
                      {
                        kind: 'bible',
                        title: label,
                        version,
                        selections: [{ book: b, chapter: c, start: v, end: v }],
                        open: () =>
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
                          }),
                      },
                    ])
                  }
                />
              </li>
            )
          })}
        </ol>
      )}
      {query.hasNextPage && (
        <button
          type="button"
          className="bs-widget-load-more"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t(query.isFetchingNextPage ? 'Chargement...' : 'assistant.widgets.more')}
        </button>
      )}
    </div>
  )
  return (
    <WidgetFrame title={widget.reference} eyebrow={t('assistant.widgets.concordance')}>
      {body}
    </WidgetFrame>
  )
}
