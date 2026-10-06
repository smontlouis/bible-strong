import { useI18n } from '@/locales'
import { bibleBookName, bibleBookSlug } from '../bible/bibleBooks'
import ResourceShell from '../resources/ResourceShell'
import type { StrongConcordancePageData } from './strong.functions'
import StrongBookCounts from './StrongBookCounts'
import StrongVerseList from './StrongVerseList'
import {
  buildStrongConcordancePath,
  buildStrongPath,
  buildWebAppStrongUrl,
  displayStrongCode,
} from './strongRoutes'

export default function StrongConcordancePage({ page }: { page: StrongConcordancePageData }) {
  const t = useI18n()
  const { language, code, book } = page
  const hebrew = page.lexicalLanguage === 'hebrew'
  const bookSlug = book === undefined ? undefined : bibleBookSlug(book)
  const basePath = buildStrongConcordancePath(language, code)
  const nextPath = page.nextCursor
    ? `${buildStrongConcordancePath(language, code, bookSlug)}${bookSlug ? '&' : '?'}cursor=${encodeURIComponent(page.nextCursor)}`
    : undefined

  return (
    <ResourceShell
      alternatePath={buildStrongConcordancePath(language === 'fr' ? 'en' : 'fr', code)}
      appUrl={buildWebAppStrongUrl(code)}
    >
      <article>
        <header>
          <p className="resource-muted text-sm font-medium uppercase tracking-[0.14em]">
            {t('strong.concordance.title')}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
            <span className="resource-chip align-middle font-semibold">
              Strong {displayStrongCode(code)}
            </span>{' '}
            <span className="font-serif" lang={hebrew ? 'he' : 'grc'} dir="auto">
              {page.original}
            </span>{' '}
            <span className="resource-muted text-xl font-normal">
              {page.transliteration} · {page.gloss}
            </span>
          </h1>
          <p className="mt-5">
            {t('strong.concordance.summary')
              .replace('{code}', `Strong ${displayStrongCode(page.classicCode)}`)
              .replace('{count}', page.verseCount.toLocaleString(language))
              .replace('{version}', page.version)}
          </p>
          <a
            className="resource-link mt-3 inline-block text-sm font-semibold"
            href={buildStrongPath(language, code)}
          >
            ← {t('strong.concordance.back')}
          </a>
        </header>

        <nav className="mt-8" aria-label={t('strong.concordance.byBook')}>
          <a
            className="resource-chip mb-2"
            aria-current={book === undefined ? 'true' : undefined}
            href={basePath}
          >
            {t('strong.concordance.allBooks')}
          </a>
          <StrongBookCounts entry={page} books={page.books} selectedBook={book} />
        </nav>

        <section className="mt-10">
          {book !== undefined && (
            <h2 className="mb-4 text-xl font-semibold">{bibleBookName(book, language)}</h2>
          )}
          <StrongVerseList verses={page.verses} version={page.version} language={language} />
          {nextPath && (
            <a className="resource-cta mt-8" href={nextPath} rel="next">
              {t('strong.concordance.next')}
            </a>
          )}
        </section>
      </article>
    </ResourceShell>
  )
}
