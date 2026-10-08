import ResourceShell from '../resources/ResourceShell'
import type { DictionaryTermPageData } from './dictionary.functions'
import { dictionaryTermBreadcrumbs } from './dictionaryBreadcrumbs'
import { dictionaryWorkName } from './dictionaryHead'
import {
  buildDictionaryEntryPath,
  buildDictionaryIndexPath,
  WEB_APP_DICTIONARY_URL,
} from './dictionaryRoutes'
import { dictionaryMessages } from './messages'

/**
 * `/dictionary/:language/term/:slug` — a term as every dictionary of the language defines
 * it: one article after the other, each under the name of its dictionary.
 */
export default function DictionaryTermPage({ page }: { page: DictionaryTermPageData }) {
  const { language, word, articles, counterpart } = page
  const t = dictionaryMessages(language)
  const articlePath = (article: (typeof articles)[number]) =>
    buildDictionaryEntryPath({
      language,
      work: article.work.id,
      entryId: article.id,
      word: article.word,
    })
  return (
    <ResourceShell
      alternatePath={
        counterpart
          ? buildDictionaryEntryPath({
              language: counterpart.language,
              work: counterpart.work,
              entryId: counterpart.id,
              word: counterpart.word,
            })
          : buildDictionaryIndexPath(language === 'fr' ? 'en' : 'fr')
      }
      appUrl={WEB_APP_DICTIONARY_URL}
      section="dictionary"
      breadcrumbs={dictionaryTermBreadcrumbs(page)}
    >
      <article>
        <header>
          <p className="resource-muted text-sm font-medium uppercase tracking-[0.14em]">
            {t('index.title')}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">{word}</h1>
          <p className="mt-4">{t('term.intro').replace('{word}', word)}</p>
          <nav className="mt-5" aria-label={t('term.works')}>
            <ul className="flex flex-wrap gap-2">
              {articles.map(article => (
                <li key={article.work.id}>
                  <a className="resource-chip" href={`#${article.work.id}`}>
                    {article.work.abbreviation}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        {articles.map(article => (
          <section key={article.work.id} id={article.work.id} className="dictionary-term mt-12">
            <h2 className="dictionary-term__work">{dictionaryWorkName(article.work)}</h2>
            <div
              className="resource-prose dictionary-prose"
              dangerouslySetInnerHTML={{ __html: article.html }}
            />
            <p className="resource-muted mt-4 text-sm">{article.work.attribution}</p>
            <a
              className="resource-link mt-2 inline-block py-1 text-sm font-semibold"
              href={articlePath(article)}
            >
              {t('term.article').replace('{work}', article.work.abbreviation)}
            </a>
          </section>
        ))}
      </article>
    </ResourceShell>
  )
}
