import LetterNav from '../resources/LetterNav'
import Pagination from '../resources/Pagination'
import ResourceShell from '../resources/ResourceShell'
import { resourceSection } from '../resources/sections'
import type {
  DictionaryIndexPageData,
  DictionaryLetterPageData,
  DictionaryWorkPageData,
} from './dictionary.functions'
import { dictionaryLetterBreadcrumbs, dictionaryWorkBreadcrumbs } from './dictionaryBreadcrumbs'
import {
  buildDictionaryEntryPath,
  buildDictionaryIndexPath,
  buildDictionaryLetterPath,
  buildDictionaryWorkPath,
  DICTIONARY_LETTERS,
  DICTIONARY_LIST_PAGE_SIZE,
  WEB_APP_DICTIONARY_URL,
} from './dictionaryRoutes'
import { dictionaryMessages } from './messages'

/** `/dictionary/:language` — the dictionaries published in a language. */
export function DictionaryIndexPage({ page }: { page: DictionaryIndexPageData }) {
  const { language, works } = page
  const t = dictionaryMessages(language)
  const otherLanguage = page.languages.find(candidate => candidate !== language)
  return (
    <ResourceShell
      alternatePath={otherLanguage && buildDictionaryIndexPath(otherLanguage)}
      appUrl={WEB_APP_DICTIONARY_URL}
      section="dictionary"
    >
      <article>
        <header>
          <p className="resource-muted text-sm font-medium uppercase tracking-[0.14em]">
            {resourceSection('dictionary').label[language]}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">{t('index.title')}</h1>
          <p className="resource-prose mt-5">{t('index.intro')}</p>
        </header>

        <ul className="mt-10 grid gap-3">
          {works.map(work => (
            <li key={work.id} className="dictionary-work resource-card resource-card--link p-5">
              <h2 className="text-xl font-semibold">
                <a
                  className="dictionary-work__link"
                  href={buildDictionaryWorkPath(language, work.id)}
                >
                  {work.title}
                </a>
              </h2>
              <p className="resource-muted mt-1 text-sm">{work.authors.join(', ')}</p>
              <p className="mt-3">{work.description}</p>
            </li>
          ))}
        </ul>
      </article>
    </ResourceShell>
  )
}

/** `/dictionary/:language/:work` — a work, its alphabet and where its text comes from. */
export function DictionaryWorkPage({ page }: { page: DictionaryWorkPageData }) {
  const { language, work, letters } = page
  const t = dictionaryMessages(language)
  const details = [
    { label: t('work.edition'), value: work.edition },
    { label: t('work.source'), value: work.source },
    { label: t('work.attribution'), value: work.attribution },
  ]
  return (
    <ResourceShell
      alternatePath={buildDictionaryIndexPath(language === 'fr' ? 'en' : 'fr')}
      appUrl={WEB_APP_DICTIONARY_URL}
      section="dictionary"
      breadcrumbs={dictionaryWorkBreadcrumbs(language, work)}
    >
      <article>
        <header>
          <h1 className="font-serif text-4xl leading-tight md:text-5xl">{work.title}</h1>
          <p className="resource-muted mt-3 text-sm">
            <span className="resource-chip mr-2 font-semibold">{work.abbreviation}</span>
            {work.authors.join(', ')}
          </p>
          <p className="resource-prose mt-5">{work.description}</p>
        </header>

        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">{t('work.letters')}</h2>
          <LetterNav
            letters={DICTIONARY_LETTERS}
            available={letters}
            hrefFor={letter => buildDictionaryLetterPath(language, work.id, letter)}
            label={`${work.title} – ${t('work.letters')}`}
          />
        </section>

        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">{t('work.about')}</h2>
          <dl className="dictionary-details">
            {details.map(detail => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </article>
    </ResourceShell>
  )
}

/** `/dictionary/:language/:work/:letter` — the articles filed under a letter. */
export function DictionaryLetterPage({ page }: { page: DictionaryLetterPageData }) {
  const { language, work, letter, entries, entryCount, pageCount } = page
  const t = dictionaryMessages(language)
  const first = (page.page - 1) * DICTIONARY_LIST_PAGE_SIZE + 1
  return (
    <ResourceShell
      alternatePath={buildDictionaryIndexPath(language === 'fr' ? 'en' : 'fr')}
      appUrl={WEB_APP_DICTIONARY_URL}
      section="dictionary"
      breadcrumbs={dictionaryLetterBreadcrumbs(language, work, letter, page.page)}
    >
      <article>
        <header>
          <h1 className="font-serif text-4xl leading-tight md:text-5xl">
            {work.title} — {letter.toUpperCase()}
          </h1>
          <p className="resource-muted mt-3 text-sm">
            {entryCount === 1
              ? t('letter.count.one')
              : t('letter.count').replace('{count}', entryCount.toLocaleString(language))}
            {pageCount > 1 &&
              ` · ${t('letter.range')
                .replace('{first}', first.toLocaleString(language))
                .replace('{last}', (first + entries.length - 1).toLocaleString(language))}`}
          </p>
        </header>

        <div className="mt-8">
          <LetterNav
            letters={DICTIONARY_LETTERS}
            available={page.letters}
            current={letter}
            hrefFor={target => buildDictionaryLetterPath(language, work.id, target)}
            label={`${work.title} – ${t('work.letters')}`}
          />
        </div>

        <ul className="strong-list mt-8">
          {entries.map(entry => (
            <li key={entry.id}>
              <a
                className="strong-list__entry"
                href={buildDictionaryEntryPath({
                  language,
                  work: work.id,
                  entryId: entry.id,
                  word: entry.word,
                })}
              >
                <span className="min-w-0 font-medium">{entry.word}</span>
              </a>
            </li>
          ))}
        </ul>

        <Pagination
          current={page.page}
          pageCount={pageCount}
          hrefFor={number => buildDictionaryLetterPath(language, work.id, letter, number)}
        />
      </article>
    </ResourceShell>
  )
}
