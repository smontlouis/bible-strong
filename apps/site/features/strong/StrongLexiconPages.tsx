import { useI18n } from '@/locales'
import { WEB_APP_ORIGIN, type ResourceLanguage } from '../resources/publicSite'
import ResourceShell from '../resources/ResourceShell'
import type { StrongIndexPageData, StrongLetterPageData } from './strong.functions'
import { strongLetterBreadcrumbs } from './strongBreadcrumbs'
import {
  buildStrongIndexPath,
  buildStrongLetterPath,
  buildStrongPath,
  displayStrongCode,
  STRONG_LETTERS,
  STRONG_LEXICONS,
  type StrongLexicalLanguage,
} from './strongRoutes'

// The lexicon list of the study workspace.
const WEB_APP_LEXICON_URL = `${WEB_APP_ORIGIN}/lexique`

/** The alphabet of a lexicon; a letter without entries is shown but not linked. */
const LetterNav = ({
  language,
  lexicon,
  letters,
  current,
}: {
  language: ResourceLanguage
  lexicon: StrongLexicalLanguage
  letters: string[]
  current?: string
}) => {
  const t = useI18n()
  return (
    <nav aria-label={`${t(`strong.lexicon.${lexicon}`)} – ${t('strong.index.letters')}`}>
      <ul className="strong-letters">
        {STRONG_LETTERS.map(letter => (
          <li key={letter}>
            {letters.includes(letter) ? (
              <a
                className="strong-letters__letter"
                aria-current={letter === current ? 'page' : undefined}
                href={buildStrongLetterPath(language, lexicon, letter)}
              >
                {letter.toUpperCase()}
              </a>
            ) : (
              <span className="strong-letters__letter" aria-hidden="true">
                {letter.toUpperCase()}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** `/strong/:language` — the Hebrew and Greek lexicons, filed by letter. */
export function StrongIndexPage({ page }: { page: StrongIndexPageData }) {
  const t = useI18n()
  const { language } = page
  return (
    <ResourceShell
      alternatePath={buildStrongIndexPath(language === 'fr' ? 'en' : 'fr')}
      appUrl={WEB_APP_LEXICON_URL}
      section="strong"
    >
      <article>
        <header>
          <p className="resource-muted text-sm font-medium uppercase tracking-[0.14em]">
            {t('strong.index.kicker')}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
            {t('strong.index.title')}
          </h1>
          <p className="resource-prose mt-5">{t('strong.index.intro')}</p>
        </header>
        {STRONG_LEXICONS.map(lexicon => (
          <section key={lexicon} id={lexicon} className="mt-12 scroll-mt-24">
            <h2 className="mb-4 text-xl font-semibold">{t(`strong.lexicon.${lexicon}`)}</h2>
            <LetterNav language={language} lexicon={lexicon} letters={page.letters[lexicon]} />
          </section>
        ))}
      </article>
    </ResourceShell>
  )
}

/** `/strong/:language/:lexicon/:letter` — the entries filed under one letter. */
export function StrongLetterPage({ page }: { page: StrongLetterPageData }) {
  const t = useI18n()
  const { language, lexicon, letter, entries } = page
  const otherLexicon = lexicon === 'hebrew' ? 'greek' : 'hebrew'
  return (
    <ResourceShell
      alternatePath={buildStrongIndexPath(language === 'fr' ? 'en' : 'fr')}
      appUrl={WEB_APP_LEXICON_URL}
      section="strong"
      breadcrumbs={strongLetterBreadcrumbs(language, lexicon, letter)}
    >
      <article>
        <header>
          <h1 className="font-serif text-4xl leading-tight md:text-5xl">
            {t(`strong.lexicon.${lexicon}`)} — {letter.toUpperCase()}
          </h1>
          <p className="resource-muted mt-3 text-sm">
            {t('strong.list.count').replace('{count}', entries.length.toLocaleString(language))}
            {' · '}
            <a className="resource-link" href={`${buildStrongIndexPath(language)}#${otherLexicon}`}>
              {t(`strong.lexicon.${otherLexicon}`)}
            </a>
          </p>
        </header>

        <div className="mt-8">
          <LetterNav language={language} lexicon={lexicon} letters={page.letters} current={letter} />
        </div>

        <ul className="strong-list mt-8">
          {entries.map(entry => (
            <li key={entry.code}>
              <a className="strong-list__entry" href={buildStrongPath(language, entry.code)}>
                <span className="strong-list__gloss">{entry.gloss}</span>
                <span
                  className="strong-list__original"
                  lang={lexicon === 'hebrew' ? 'he' : 'grc'}
                  dir="auto"
                >
                  {entry.original}
                </span>
                <span className="strong-list__code">
                  {displayStrongCode(entry.code)}
                  {/* The list gathers the entries naming one person, so it cannot count them. */}
                  {entry.senseCount && (
                    <span className="strong-list__senses">{t('strong.list.several')}</span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </article>
    </ResourceShell>
  )
}
