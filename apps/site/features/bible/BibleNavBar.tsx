import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/locales'
import type { BiblePageData } from './bible.functions'
import { bibleBookName } from './bibleBooks'
import {
  buildBiblePath,
  closestBiblePresentation,
  isBiblePresentationSupported,
  supportedBiblePresentations,
} from './bibleRoutes'
import { BIBLE_VERSIONS, bibleVersionName, type BibleVersion } from './bibleVersions'

const VERSION_GROUPS = ['fr', 'en', 'other'] as const

const versionGroup = (version: BibleVersion): (typeof VERSION_GROUPS)[number] =>
  version.language === 'fr' || version.language === 'en' ? version.language : 'other'

/** The study aids a version offers beyond its text, shown as badges in the selector. */
const versionAids = (versionId: string): ('strong' | 'interlinear')[] => [
  ...(isBiblePresentationSupported(versionId, 'strong') ? (['strong'] as const) : []),
  ...(isBiblePresentationSupported(versionId, 'reverse-interlinear') ||
  isBiblePresentationSupported(versionId, 'interlinear')
    ? (['interlinear'] as const)
    : []),
]

const Chevron = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 shrink-0">
    <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

/**
 * Book, chapter, version and reading-mode controls of a Bible page, as in the study
 * workspace. Panels are native disclosures holding plain links, so they work before
 * hydration and every destination stays reachable by a crawler.
 */
export default function BibleNavBar({ page }: { page: BiblePageData }) {
  const t = useI18n()
  const { versionId, presentation, language, book, chapter, passage, gloss } = page
  const barRef = useRef<HTMLDivElement>(null)
  // The book whose chapters are listed; `undefined` shows the list of books.
  const [openBook, setOpenBook] = useState<number | undefined>(book)

  useEffect(() => {
    const closePanels = () =>
      barRef.current
        ?.querySelectorAll('details[open]')
        .forEach(panel => panel.removeAttribute('open'))
    const onPointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) closePanels()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanels()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const location = { versionId, presentation, book, chapter, gloss }
  const testaments = [
    // Deuterocanonical books (67 and above) are read within the Old Testament.
    { key: 'oldTestament' as const, books: page.books.filter(entry => entry.book < 40 || entry.book > 66) },
    { key: 'newTestament' as const, books: page.books.filter(entry => entry.book >= 40 && entry.book <= 66) },
  ].filter(testament => testament.books.length > 0)
  const openBookChapters = page.books.find(entry => entry.book === openBook)?.chapters ?? 0
  const carried = new Set(page.versionIds)
  const versions = BIBLE_VERSIONS.filter(version => carried.has(version.id))
  const modes = supportedBiblePresentations(versionId)

  return (
    <div ref={barRef} className="bible-nav">
      <details name="bible-nav">
        <summary
          className="bible-nav__trigger"
          aria-label={`${bibleBookName(book, language)} ${chapter} – ${t('bible.nav.books')}`}
        >
          <span className="truncate">
            {bibleBookName(book, language)} {chapter}
          </span>
          <Chevron />
        </summary>
        <div className="bible-nav__panel">
          <div hidden={openBook === undefined}>
            <button type="button" className="bible-nav__back" onClick={() => setOpenBook(undefined)}>
              ← {t('bible.nav.books')}
            </button>
            {openBook !== undefined && (
              <>
                <p className="bible-nav__title">{bibleBookName(openBook, language)}</p>
                <ul className="bible-nav__grid">
                  {Array.from({ length: openBookChapters }, (_, index) => index + 1).map(number => (
                    <li key={number}>
                      <a
                        className="bible-nav__cell"
                        aria-current={openBook === book && number === chapter ? 'page' : undefined}
                        href={buildBiblePath({ ...location, book: openBook, chapter: number })}
                      >
                        {number}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div hidden={openBook !== undefined}>
            {testaments.map(testament => (
              <section key={testament.key}>
                <p className="bible-nav__title">{t(`bible.nav.${testament.key}`)}</p>
                <ul className="bible-nav__list">
                  {testament.books.map(entry => (
                    <li key={entry.book}>
                      <a
                        className="bible-nav__item"
                        aria-current={entry.book === book ? 'true' : undefined}
                        href={buildBiblePath({ ...location, book: entry.book, chapter: 1 })}
                        onClick={event => {
                          // With scripting, a book first reveals its chapters.
                          event.preventDefault()
                          setOpenBook(entry.book)
                        }}
                      >
                        {bibleBookName(entry.book, language)}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </details>

      <details name="bible-nav">
        <summary
          className="bible-nav__trigger"
          aria-label={`${versionId} – ${t('bible.nav.versions')}`}
        >
          <span>{versionId}</span>
          <Chevron />
        </summary>
        <div className="bible-nav__panel">
          {VERSION_GROUPS.map(group => {
            const groupVersions = versions.filter(version => versionGroup(version) === group)
            if (!groupVersions.length) return null
            return (
              <section key={group}>
                <p className="bible-nav__title">{t(`bible.nav.language.${group}`)}</p>
                <ul className="bible-nav__list bible-nav__list--wide">
                  {groupVersions.map(version => (
                    <li key={version.id}>
                      <a
                        className="bible-nav__item bible-nav__item--version"
                        aria-current={version.id === versionId ? 'true' : undefined}
                        href={buildBiblePath({
                          versionId: version.id,
                          presentation: closestBiblePresentation(version.id, presentation),
                          book,
                          chapter,
                          passage,
                          // An interlinear reading opened from here speaks the page language.
                          gloss: language,
                        })}
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-semibold">{version.id}</span>
                          <span className="resource-muted ml-2 text-sm">
                            {bibleVersionName(version, language)}
                          </span>
                        </span>
                        {versionAids(version.id).map(aid => (
                          <span key={aid} className="bible-nav__badge">
                            {t(`bible.aid.${aid}`)}
                          </span>
                        ))}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </details>

      {modes.length > 1 && (
        <details name="bible-nav" className="bible-nav__mode">
          <summary
            className="bible-nav__trigger"
            aria-label={`${t(`bible.mode.${presentation}`)} – ${t('bible.nav.mode')}`}
          >
            <span className="bible-nav__label">{t('bible.nav.modeLabel')}</span>
            <span className="truncate">{t(`bible.mode.${presentation}`)}</span>
            <Chevron />
          </summary>
          <div className="bible-nav__panel">
            <p className="bible-nav__title">{t('bible.nav.mode')}</p>
            <ul className="bible-nav__list bible-nav__list--wide">
              {modes.map(mode => (
                <li key={mode}>
                  <a
                    className="bible-nav__item bible-nav__item--mode"
                    aria-current={mode === presentation ? 'true' : undefined}
                    href={buildBiblePath({ ...location, presentation: mode, passage, gloss: language })}
                  >
                    <span className="font-semibold">{t(`bible.mode.${mode}`)}</span>
                    <span className="resource-muted block text-sm">{t(`bible.mode.${mode}.hint`)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  )
}
