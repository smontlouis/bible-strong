import { useI18n } from '@/locales'
import { WEB_APP_ORIGIN, type ResourceLanguage } from '../resources/publicSite'
import ResourceShell from '../resources/ResourceShell'
import { resourceSection } from '../resources/sections'
import type { BibleVersionPageData } from './bible.functions'
import { bibleBookName } from './bibleBooks'
import { bibleVersionBreadcrumbs } from './bibleBreadcrumbs'
import {
  bibleVersionAids,
  buildBiblePath,
  buildBibleVersionPath,
  INTERLINEAR_VERSION_ID,
  supportedBiblePresentations,
  type BiblePresentation,
} from './bibleRoutes'
import {
  BIBLE_VERSIONS,
  bibleVersionName,
  defaultBibleVersionId,
  findBibleVersion,
  type BibleVersion,
} from './bibleVersions'

type VersionGroup = 'fr' | 'en' | 'other'

const versionGroup = (version: BibleVersion): VersionGroup =>
  version.language === 'fr' || version.language === 'en' ? version.language : 'other'

// Genesis 1, Psalm 23 and John 1: where most readers start.
const STARTING_POINTS = [
  { book: 1, chapter: 1 },
  { book: 19, chapter: 23 },
  { book: 43, chapter: 1 },
]

// The study readings are introduced on the prologue of John.
const STUDY_PASSAGE = { book: 43, chapter: 1 }

/** `/bible` and `/fr/bible` — where to start, the study readings and every version. */
export function BibleHubPage({ language }: { language: ResourceLanguage }) {
  const t = useI18n()
  const section = resourceSection('bible')
  const versionId = defaultBibleVersionId(language)
  const groups: VersionGroup[] = language === 'fr' ? ['fr', 'en', 'other'] : ['en', 'fr', 'other']
  const studyReadings: { presentation: BiblePresentation; versionId: string }[] = [
    { presentation: 'strong', versionId },
    { presentation: 'reverse-interlinear', versionId },
    { presentation: 'interlinear', versionId: INTERLINEAR_VERSION_ID },
  ]

  return (
    <ResourceShell
      alternatePath={section.path(language === 'fr' ? 'en' : 'fr')}
      appUrl={WEB_APP_ORIGIN}
      section="bible"
    >
      <article>
        <header>
          <p className="resource-muted text-sm font-medium uppercase tracking-[0.14em]">
            {section.label[language]}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
            {t('bible.hub.title')}
          </h1>
          <p className="resource-prose mt-5">{t('bible.hub.intro')}</p>
        </header>

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">{t('bible.hub.start')}</h2>
          <ul className="flex flex-wrap gap-2">
            {STARTING_POINTS.map(point => (
              <li key={point.book}>
                <a
                  className="resource-chip resource-chip--action"
                  href={buildBiblePath({ versionId, ...point })}
                >
                  {bibleBookName(point.book, language)} {point.chapter}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">{t('bible.hub.study')}</h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {studyReadings.map(reading => (
              <li key={reading.presentation}>
                <a
                  className="resource-card resource-card--link block h-full p-4"
                  href={buildBiblePath({ ...reading, ...STUDY_PASSAGE, gloss: language })}
                >
                  <span className="font-semibold">{t(`bible.mode.${reading.presentation}`)}</span>
                  <span className="resource-muted mt-1 block text-sm">
                    {t(`bible.mode.${reading.presentation}.hint`)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="mb-2 text-xl font-semibold">{t('bible.hub.versions')}</h2>
          {groups.map(group => (
            <section key={group}>
              <h3 className="bible-nav__title">{t(`bible.nav.language.${group}`)}</h3>
              <ul className="bible-nav__list bible-nav__list--wide">
                {BIBLE_VERSIONS.filter(version => versionGroup(version) === group).map(version => (
                  <li key={version.id}>
                    <a
                      className="bible-nav__item bible-nav__item--version"
                      href={buildBibleVersionPath(version.id)}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold">{version.id}</span>
                        <span className="resource-muted ml-2 text-sm">
                          {bibleVersionName(version, language)}
                        </span>
                      </span>
                      {bibleVersionAids(version.id).map(aid => (
                        <span key={aid} className="bible-nav__badge">
                          {t(`bible.aid.${aid}`)}
                        </span>
                      ))}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      </article>
    </ResourceShell>
  )
}

/** `/bible/:version` — the reading modes of a version, then its books and chapters. */
export function BibleVersionPage({ page }: { page: BibleVersionPageData }) {
  const t = useI18n()
  const { versionId, language, books } = page
  const version = findBibleVersion(versionId)
  const first = books[0]
  const testaments = [
    // Deuterocanonical books (67 and above) are read within the Old Testament.
    { key: 'oldTestament' as const, books: books.filter(entry => entry.book < 40 || entry.book > 66) },
    { key: 'newTestament' as const, books: books.filter(entry => entry.book >= 40 && entry.book <= 66) },
  ].filter(testament => testament.books.length > 0)
  const chapterCount = books.reduce((total, entry) => total + entry.chapters.length, 0)

  return (
    <ResourceShell
      appUrl={
        first
          ? `${WEB_APP_ORIGIN}${buildBiblePath({ versionId, book: first.book, chapter: first.chapters[0] ?? 1 })}`
          : WEB_APP_ORIGIN
      }
      section="bible"
      breadcrumbs={bibleVersionBreadcrumbs(versionId, language)}
    >
      <article>
        <header>
          <h1 className="font-serif text-4xl leading-tight md:text-5xl">
            {version ? bibleVersionName(version, language) : versionId}
          </h1>
          <p className="resource-muted mt-3 text-sm">
            <span className="resource-chip mr-2 font-semibold">{versionId}</span>
            {t('bible.version.summary')
              .replace('{books}', String(books.length))
              .replace('{chapters}', chapterCount.toLocaleString(language))}
          </p>
        </header>

        {first && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-semibold">{t('bible.nav.mode')}</h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {supportedBiblePresentations(versionId).map(presentation => (
                <li key={presentation}>
                  <a
                    className="resource-card resource-card--link block h-full p-4"
                    href={buildBiblePath({
                      versionId,
                      presentation,
                      book: first.book,
                      chapter: first.chapters[0] ?? 1,
                      gloss: language,
                    })}
                  >
                    <span className="font-semibold">{t(`bible.mode.${presentation}`)}</span>
                    <span className="resource-muted mt-1 block text-sm">
                      {t(`bible.mode.${presentation}.hint`)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {testaments.map(testament => (
          <section key={testament.key} className="mt-12">
            <h2 className="mb-2 text-xl font-semibold">{t(`bible.nav.${testament.key}`)}</h2>
            <ul className="bible-books">
              {testament.books.map(entry => (
                <li key={entry.book}>
                  <details className="resource-details bible-book">
                    <summary>
                      <span className="font-medium">{bibleBookName(entry.book, language)}</span>
                      <span className="resource-muted ml-2 text-sm">
                        {entry.chapters.length === 1
                          ? t('bible.version.chapter')
                          : t('bible.version.chapters').replace(
                              '{count}',
                              String(entry.chapters.length)
                            )}
                      </span>
                    </summary>
                    <ul className="bible-nav__grid pb-4">
                      {entry.chapters.map(chapter => (
                        <li key={chapter}>
                          <a
                            className="bible-nav__cell"
                            href={buildBiblePath({ versionId, book: entry.book, chapter })}
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

        {version?.copyright && (
          <p className="resource-muted mt-10 text-xs">
            {bibleVersionName(version, language)} — {version.copyright}
          </p>
        )}
      </article>
    </ResourceShell>
  )
}
