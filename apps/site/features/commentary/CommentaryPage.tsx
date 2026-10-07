import { bibleBookName } from '../bible/bibleBooks'
import ResourceShell from '../resources/ResourceShell'
import type { CommentaryPageData } from './commentary.functions'
import { commentaryBreadcrumbs } from './commentaryBreadcrumbs'
import {
  buildCommentaryChapterPath,
  buildCommentaryIndexPath,
  buildCommentaryPath,
  otherResourceLanguage,
  WEB_APP_COMMENTARIES_URL,
} from './commentaryRoutes'
import { commentaryMessages } from './messages'

/** `/commentary/:language/:resource` — a commentary, then the books and chapters it covers. */
export default function CommentaryPage({ page }: { page: CommentaryPageData }) {
  const { language, commentary, coverage } = page
  const t = commentaryMessages(language)
  const otherLanguage = otherResourceLanguage(language)
  const counterpartPath = page.counterpart && buildCommentaryPath(otherLanguage, page.counterpart)
  const chapterPath = (book: number, chapter: number) =>
    buildCommentaryChapterPath({ language, resource: commentary.id, book, chapter })
  // A commentary without a commented chapter is not found, so there is a first one.
  const start = chapterPath(coverage[0].book, coverage[0].chapters[0])
  const chapterCount = coverage.reduce((total, entry) => total + entry.chapters.length, 0)
  const testaments = [
    // Deuterocanonical books (67 and above) are read within the Old Testament.
    { key: 'old' as const, books: coverage.filter(entry => entry.book < 40 || entry.book > 66) },
    { key: 'new' as const, books: coverage.filter(entry => entry.book >= 40 && entry.book <= 66) },
  ].filter(testament => testament.books.length > 0)

  return (
    <ResourceShell
      // A commentary published in one language switches to the commentaries of the other.
      alternatePath={counterpartPath ?? buildCommentaryIndexPath(otherLanguage)}
      appUrl={WEB_APP_COMMENTARIES_URL}
      section="commentary"
      breadcrumbs={commentaryBreadcrumbs(language, commentary)}
    >
      <article lang={language}>
        <header>
          <h1 className="font-serif text-4xl leading-tight md:text-5xl">{commentary.title}</h1>
          <p className="resource-muted mt-3">{commentary.author}</p>
          {commentary.description && (
            <p className="resource-prose mt-5">{commentary.description}</p>
          )}
          <p className="resource-muted mt-4 text-sm">
            {t(
              coverage.length === 1
                ? 'commentary.resource.summary.oneBook'
                : 'commentary.resource.summary',
              { books: coverage.length, chapters: chapterCount.toLocaleString(language) }
            )}
          </p>
          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <li>
              <a className="resource-chip resource-chip--action" href={start}>
                {t('commentary.resource.start')}
              </a>
            </li>
            {counterpartPath && (
              <li>
                <a className="resource-link inline-block py-1 text-sm" href={counterpartPath}>
                  {t('commentary.resource.otherLanguage')}
                </a>
              </li>
            )}
          </ul>
        </header>

        {testaments.map(testament => (
          <section key={testament.key} className="mt-12">
            <h2 className="mb-2 text-xl font-semibold">
              {t(`commentary.testament.${testament.key}`)}
            </h2>
            <ul className="bible-books">
              {testament.books.map(entry => (
                <li key={entry.book}>
                  {/* A commentary on a single book shows its chapters at once. */}
                  <details className="resource-details bible-book" open={coverage.length === 1}>
                    <summary>
                      <span className="font-medium">{bibleBookName(entry.book, language)}</span>
                      <span className="resource-muted ml-2 text-sm">
                        {entry.chapters.length === 1
                          ? t('commentary.chapter')
                          : t('commentary.chapters', { count: entry.chapters.length })}
                      </span>
                    </summary>
                    <ul className="bible-nav__grid pb-4">
                      {entry.chapters.map(chapter => (
                        <li key={chapter}>
                          <a
                            className="bible-nav__cell"
                            href={chapterPath(entry.book, chapter)}
                            aria-label={`${bibleBookName(entry.book, language)} ${chapter}`}
                          >
                            {chapter}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="resource-muted mt-10 text-xs">
          {commentary.title} — {commentary.rights}
        </p>
      </article>
    </ResourceShell>
  )
}
