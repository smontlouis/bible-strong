import ResourceShell from '../resources/ResourceShell'
import type { DictionaryEntryPageData, DictionaryListEntry } from './dictionary.functions'
import { dictionaryEntryBreadcrumbs } from './dictionaryBreadcrumbs'
import {
  buildDictionaryEntryPath,
  buildDictionaryIndexPath,
  buildDictionaryLetterPath,
  buildDictionaryWorkPath,
  buildWebAppDictionaryEntryUrl,
} from './dictionaryRoutes'
import { dictionaryMessages } from './messages'

/** `/dictionary/:language/:work/:entryId/:slug` — an article of a dictionary. */
export default function DictionaryEntryPage({ page }: { page: DictionaryEntryPageData }) {
  const { language, work, word, letter, related } = page
  const t = dictionaryMessages(language)
  const entryPath = (entry: DictionaryListEntry) =>
    buildDictionaryEntryPath({ language, work: work.id, entryId: entry.id, word: entry.word })
  const relatedPath = (article: (typeof related)[number]) =>
    buildDictionaryEntryPath({
      language: article.language,
      work: article.work,
      entryId: article.id,
      word: article.word,
    })
  // A work exists in one language: the other language offers the same notion in one of its
  // dictionaries when the Resource API knows one, its list of dictionaries otherwise.
  const otherLanguage = language === 'fr' ? 'en' : 'fr'
  const counterpart = related.find(article => article.language === otherLanguage)
  return (
    <ResourceShell
      alternatePath={
        counterpart ? relatedPath(counterpart) : buildDictionaryIndexPath(otherLanguage)
      }
      appUrl={buildWebAppDictionaryEntryUrl({ language, work: work.id, entryId: page.id, word })}
      section="dictionary"
      breadcrumbs={dictionaryEntryBreadcrumbs(page)}
    >
      <article>
        <header>
          <h1 className="font-serif text-4xl leading-tight md:text-5xl">{word}</h1>
          <p className="resource-muted mt-3 text-sm">
            <a className="resource-link" href={buildDictionaryWorkPath(language, work.id)}>
              {work.title}
            </a>
            {' · '}
            {work.authors.join(', ')}
          </p>
        </header>

        <div
          className="resource-prose dictionary-prose mt-8"
          dangerouslySetInnerHTML={{ __html: page.html }}
        />

        {letter && (
          <nav className="mt-12" aria-label={t('entry.neighbours')}>
            {(page.previous || page.next) && (
              <ul className="dictionary-neighbours mb-5">
                {page.previous && (
                  <li>
                    <a
                      className="resource-card resource-card--link block h-full px-4 py-3"
                      rel="prev"
                      href={entryPath(page.previous)}
                    >
                      <span className="resource-muted block text-xs">← {t('entry.previous')}</span>
                      <span className="mt-1 block font-medium">{page.previous.word}</span>
                    </a>
                  </li>
                )}
                {page.next && (
                  <li className="dictionary-neighbours__next">
                    <a
                      className="resource-card resource-card--link block h-full px-4 py-3"
                      rel="next"
                      href={entryPath(page.next)}
                    >
                      <span className="resource-muted block text-xs">{t('entry.next')} →</span>
                      <span className="mt-1 block font-medium">{page.next.word}</span>
                    </a>
                  </li>
                )}
              </ul>
            )}
            <a
              className="resource-link inline-block py-1 text-sm font-semibold"
              href={buildDictionaryLetterPath(language, work.id, letter)}
            >
              {t('entry.letter').replace('{letter}', letter.toUpperCase())}
            </a>
          </nav>
        )}

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-semibold">{t('entry.related')}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {related.map(article => (
                <li key={`${article.language}-${article.work}-${article.id}`}>
                  <a
                    className="resource-card resource-card--link block h-full px-4 py-3"
                    href={relatedPath(article)}
                    hrefLang={article.language === language ? undefined : article.language}
                  >
                    <span className="block font-medium" lang={article.language}>
                      {article.word}
                    </span>
                    <span className="resource-muted mt-1 block text-sm" lang={article.language}>
                      {article.workTitle}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12">
          <h2 className="mb-2 text-xl font-semibold">{t('entry.source')}</h2>
          <p className="resource-muted text-sm">{work.attribution}</p>
          <p className="resource-muted mt-1 text-sm">{work.edition}</p>
        </section>
      </article>
    </ResourceShell>
  )
}
