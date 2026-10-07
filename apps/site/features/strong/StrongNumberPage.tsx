import { useI18n } from '@/locales'
import { bibleBookName } from '../bible/bibleBooks'
import ResourceShell from '../resources/ResourceShell'
import type { StrongNumberPageData, StrongNumberSense } from './strong.functions'
import { strongNumberBreadcrumbs } from './strongBreadcrumbs'
import { Prose, Section } from './StrongEntryPage'
import { buildStrongPath, buildWebAppStrongUrl, displayStrongCode } from './strongRoutes'

// A sense read in a few books names them; beyond that their number says enough.
const NAMED_BOOK_COUNT = 3
// The heading names the first glosses; every sense is listed below it.
const HEADING_GLOSS_COUNT = 6

/**
 * `/strong/:language/:code` for a classical number the lexicon splits into senses: the word
 * once, then each sense with what tells it apart and where it is read.
 */
export default function StrongNumberPage({ page }: { page: StrongNumberPageData }) {
  const t = useI18n()
  const { language, concordance, senses } = page
  const code = `Strong ${displayStrongCode(page.code)}`
  const hebrew = page.lexicalLanguage === 'hebrew'
  const count = String(senses.length)
  // Senses that all read the same (thirty times "Zechariah") are named by what tells them
  // apart; the gloss they share is already the heading of the page.
  const sameGloss = page.glosses.length === 1

  const readIn = (sense: StrongNumberSense): string | undefined => {
    if (!concordance) return undefined
    if (!sense.verseCount)
      return t('strong.number.absent').replace('{version}', concordance.version)
    const verses = t(
      sense.verseCount === 1 ? 'strong.number.verse' : 'strong.number.verses'
    ).replace('{count}', sense.verseCount.toLocaleString(language))
    const books =
      sense.books.length <= NAMED_BOOK_COUNT
        ? sense.books.map(book => bibleBookName(book, language)).join(', ')
        : t('strong.number.books').replace('{count}', String(sense.books.length))
    return `${verses} · ${books}`
  }

  return (
    <ResourceShell
      alternatePath={buildStrongPath(language === 'fr' ? 'en' : 'fr', page.code)}
      appUrl={buildWebAppStrongUrl(page.code)}
      section="strong"
      breadcrumbs={strongNumberBreadcrumbs(page)}
    >
      <article>
        <header>
          <h1>
            <span className="resource-chip font-semibold">{code}</span>
            <span className="resource-muted ml-3 text-sm font-medium">
              {t('strong.number.count').replace('{count}', count)}
            </span>
            <span
              className="mt-4 block text-left font-serif text-5xl leading-tight md:text-6xl"
              lang={hebrew ? 'he' : 'grc'}
              dir="auto"
            >
              {page.original}
            </span>
          </h1>
          <p className="mt-4 text-2xl font-medium">
            {page.glosses.slice(0, HEADING_GLOSS_COUNT).join(' · ')}
            {page.glosses.length > HEADING_GLOSS_COUNT && ' …'}
          </p>
          <dl className="resource-muted mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="sr-only">{t('strong.transliteration')}</dt>
              <dd className="text-base italic">{page.transliteration}</dd>
            </div>
            {page.pronunciation && (
              <div className="flex gap-2">
                <dt>{t('strong.pronunciation')}</dt>
                <dd>{page.pronunciation}</dd>
              </div>
            )}
          </dl>
        </header>

        {page.nameMeaningHtml && (
          <Section title={t('strong.nameMeaning')}>
            <Prose html={page.nameMeaningHtml} />
          </Section>
        )}

        <Section
          title={t('strong.number.senses').replace('{count}', count).replace('{code}', code)}
        >
          <p>
            {t('strong.number.intro').replace('{count}', count)}
            {concordance &&
              ` ${t(
                concordance.verseCount === 1 ? 'strong.number.total.one' : 'strong.number.total'
              )
                .replace('{code}', code)
                .replace('{count}', concordance.verseCount.toLocaleString(language))
                .replace('{version}', concordance.version)}`}
          </p>
          <ol className="strong-senses mt-6">
            {senses.map(sense => {
              const verses = readIn(sense)
              const name = (sameGloss && sense.summary) || sense.gloss
              const summary = name === sense.summary ? undefined : sense.summary
              return (
                <li key={sense.code}>
                  <a
                    className="strong-senses__sense resource-card"
                    href={buildStrongPath(language, sense.code)}
                  >
                    <span className="strong-senses__head">
                      <span className="strong-senses__gloss">{name}</span>
                      {/* A sense written another way than its number shows its own spelling. */}
                      {sense.original !== page.original && (
                        <span
                          className="strong-senses__original"
                          lang={hebrew ? 'he' : 'grc'}
                          dir="auto"
                        >
                          {sense.original}
                        </span>
                      )}
                      <span className="strong-senses__code">{displayStrongCode(sense.code)}</span>
                    </span>
                    {summary && <span className="strong-senses__summary">{summary}</span>}
                    {verses && <span className="strong-senses__verses">{verses}</span>}
                  </a>
                </li>
              )
            })}
          </ol>
        </Section>

        {page.definitionHtml && (
          <Section title={t('strong.generalDefinition')}>
            <Prose html={page.definitionHtml} />
          </Section>
        )}
      </article>
    </ResourceShell>
  )
}
