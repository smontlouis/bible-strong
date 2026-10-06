import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useI18n } from '@/locales'
import ResourceShell from '../resources/ResourceShell'
import type { StrongPageData, StrongPageRelation } from './strong.functions'
import StrongBookCounts from './StrongBookCounts'
import StrongVerseList from './StrongVerseList'
import {
  buildStrongConcordancePath,
  buildStrongIndexPath,
  buildStrongLetterPath,
  buildStrongPath,
  buildWebAppStrongUrl,
  displayStrongCode,
  strongCodeSlug,
  strongGlossLetter,
} from './strongRoutes'

const RELATION_GROUPS = ['subentry', 'family', 'identity'] as const

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mt-12">
    <h2 className="mb-4 text-xl font-semibold">{title}</h2>
    {children}
  </section>
)

const Prose = ({ html }: { html: string }) => (
  <div className="resource-prose" dangerouslySetInnerHTML={{ __html: html }} />
)

const RelationList = ({
  relations,
  entry,
}: {
  relations: StrongPageRelation[]
  entry: StrongPageData
}) => (
  <ul className="grid gap-2 sm:grid-cols-2">
    {relations.map(relation => (
      <li key={`${relation.group}-${relation.code}`}>
        <Link
          to="/strong/$language/$code"
          params={{ language: entry.language, code: strongCodeSlug(relation.code) }}
          className="resource-card flex h-full items-baseline justify-between gap-3 px-4 py-3"
        >
          <span className="min-w-0">
            <span
              className="font-serif text-lg"
              lang={relation.code.startsWith('H') ? 'he' : 'grc'}
              dir="auto"
            >
              {relation.original}
            </span>
            <span className="resource-muted ml-2 text-sm">{relation.gloss}</span>
          </span>
          <span className="resource-muted shrink-0 text-xs">
            {displayStrongCode(relation.code)}
          </span>
        </Link>
      </li>
    ))}
  </ul>
)

export default function StrongEntryPage({ entry }: { entry: StrongPageData }) {
  const t = useI18n()
  const { language, concordance } = entry
  const displayCode = displayStrongCode(entry.code)
  const hebrew = entry.lexicalLanguage === 'hebrew'
  const appUrl = buildWebAppStrongUrl(entry.code)
  const glossLetter = strongGlossLetter(entry.gloss)

  return (
    <ResourceShell
      alternatePath={buildStrongPath(language === 'fr' ? 'en' : 'fr', entry.code)}
      appUrl={appUrl}
    >
      <article>
        <header>
          <a
            className="resource-muted text-sm font-medium uppercase tracking-[0.14em]"
            href={
              glossLetter
                ? buildStrongLetterPath(language, entry.lexicalLanguage, glossLetter)
                : buildStrongIndexPath(language)
            }
          >
            ← {t(hebrew ? 'strong.lexicon.hebrew' : 'strong.lexicon.greek')}
          </a>
          <h1 className="mt-3">
            <span className="resource-chip font-semibold">Strong {displayCode}</span>
            <span
              className="mt-4 block text-left font-serif text-5xl leading-tight md:text-6xl"
              lang={hebrew ? 'he' : 'grc'}
              dir="auto"
            >
              {entry.original}
            </span>
          </h1>
          <p className="mt-4 text-2xl font-medium">{entry.gloss}</p>
          <dl className="resource-muted mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="sr-only">{t('strong.transliteration')}</dt>
              <dd className="text-base italic">{entry.transliteration}</dd>
            </div>
            {entry.pronunciation && (
              <div className="flex gap-2">
                <dt>{t('strong.pronunciation')}</dt>
                <dd>{entry.pronunciation}</dd>
              </div>
            )}
            {entry.morphology && (
              <div className="flex gap-2">
                <dt>{t('strong.morphology')}</dt>
                <dd>{entry.morphology.meaning}</dd>
              </div>
            )}
          </dl>
        </header>

        {entry.definitionHtml && (
          <Section title={t('strong.definition')}>
            <Prose html={entry.definitionHtml} />
          </Section>
        )}

        {entry.nameMeaningHtml && (
          <Section title={t('strong.nameMeaning')}>
            <Prose html={entry.nameMeaningHtml} />
          </Section>
        )}

        {entry.detailedDefinitionHtml && (
          <Section title={t('strong.detailedDefinition')}>
            <Prose html={entry.detailedDefinitionHtml} />
          </Section>
        )}

        {entry.entity && (
          <Section title={t('strong.entity')}>
            <div className="resource-card px-5 py-4">
              <p className="font-semibold">{entry.entity.name}</p>
              {entry.entity.brief && <p className="resource-muted text-sm">{entry.entity.brief}</p>}
              {entry.entity.description && (
                <p className="resource-prose mt-3">{entry.entity.description}</p>
              )}
            </div>
          </Section>
        )}

        {concordance && (
          <Section title={t('strong.concordance')}>
            <p>
              {t('strong.concordance.summary')
                .replace('{code}', `Strong ${displayStrongCode(entry.classicCode)}`)
                .replace('{count}', concordance.verseCount.toLocaleString(language))
                .replace('{version}', concordance.version)}
            </p>

            {concordance.verses.length > 0 && (
              <>
                <h3 className="resource-muted mb-3 mt-8 text-sm font-semibold uppercase tracking-[0.1em]">
                  {t('strong.concordance.firstVerses')}
                </h3>
                <StrongVerseList
                  verses={concordance.verses}
                  version={concordance.version}
                  language={language}
                />
                <a
                  className="resource-link mt-5 inline-block text-sm font-semibold"
                  href={buildStrongConcordancePath(language, entry.code)}
                >
                  {t('strong.concordance.all')}
                </a>
              </>
            )}

            <h3 className="resource-muted mb-3 mt-8 text-sm font-semibold uppercase tracking-[0.1em]">
              {t('strong.concordance.byBook')}
            </h3>
            <StrongBookCounts entry={entry} books={concordance.books} />
          </Section>
        )}

        {entry.relations.length > 0 && (
          <Section title={t('strong.relations')}>
            {RELATION_GROUPS.map(group => {
              const relations = entry.relations.filter(relation => relation.group === group)
              if (!relations.length) return null
              return (
                <div key={group} className="mt-6 first:mt-0">
                  <h3 className="resource-muted mb-3 text-sm font-semibold uppercase tracking-[0.1em]">
                    {t(`strong.relations.${group}`)}
                  </h3>
                  <RelationList relations={relations} entry={entry} />
                </div>
              )
            })}
          </Section>
        )}

        {entry.dictionaryArticles.map(article => (
          <details key={article.title} className="resource-details resource-card mt-12 px-5 py-4">
            <summary className="text-lg font-semibold">{article.title}</summary>
            <div className="mt-4">
              <Prose html={article.html} />
            </div>
          </details>
        ))}
      </article>
    </ResourceShell>
  )
}
