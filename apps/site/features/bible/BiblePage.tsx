import { useEffect, useLayoutEffect, useRef } from 'react'
import { useI18n } from '@/locales'
import ResourceShell from '../resources/ResourceShell'
import StrongPreviewPopover from '../strong/StrongPreviewPopover'
import type { BibleChapterRef, BibleInterlinearWord, BiblePageData } from './bible.functions'
import { bibleBookName } from './bibleBooks'
import { bibleBreadcrumbs } from './bibleBreadcrumbs'
import BibleCommentaryDialog from './BibleCommentaryDialog'
import { withInlineCommentaries } from './bibleCommentaries'
import BibleNavBar from './BibleNavBar'
import BibleNotePopover from './BibleNotePopover'
import {
  buildBiblePath,
  buildWebAppBibleUrl,
  closestBiblePresentation,
} from './bibleRoutes'
import { bibleVersionName, findBibleVersion } from './bibleVersions'

// The language switch opens the same passage in the reference Bible of the other language.
const ALTERNATE_VERSION = { fr: 'KJV', en: 'LSG' } as const

// A layout effect has nothing to do while the page is rendered on the server.
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * One aligned unit. A direct interlinear stacks the original word, its transliteration and
 * its gloss; a reverse interlinear stacks the translation and the original words behind it.
 */
const InterlinearWord = ({
  word,
  originalLang,
  direct,
}: {
  word: BibleInterlinearWord
  originalLang: string
  direct: boolean
}) => (
  <span className="interlinear__word">
    <span className="interlinear__text" lang={direct ? originalLang : undefined}>
      {word.text}
    </span>
    {word.original && (
      <span className="interlinear__original" lang={originalLang} dir="auto">
        {word.original}
      </span>
    )}
    {word.transliteration && (
      <span className="interlinear__transliteration">{word.transliteration}</span>
    )}
    {word.gloss && <span className="interlinear__gloss">{word.gloss}</span>}
    {word.strong.length > 0 && (
      <span className="interlinear__strong">
        {word.strong.map(link => (
          <a key={link.code} href={link.path} data-strong={link.code}>
            {link.label}
          </a>
        ))}
      </span>
    )}
  </span>
)

export default function BiblePage({ page }: { page: BiblePageData }) {
  const t = useI18n()
  const articleRef = useRef<HTMLElement>(null)
  const { versionId, presentation, language, book, chapter, passage, gloss } = page
  const version = findBibleVersion(versionId)
  const bookName = bibleBookName(book, language)
  const location = { versionId, presentation, book, chapter, gloss }
  // The commentaries shown in the text follow the reader along the links of the page.
  const keep = (path: string) => withInlineCommentaries(path, page.commentaryChoice)

  // Showing or hiding a commentary adds or removes text above what is being read: the
  // first verse in view is brought back to where it was.
  const place = useRef<{ id: string; top: number }>()
  const rememberPlace = () => {
    const numbers = articleRef.current?.querySelectorAll<HTMLElement>('.bible-verse-number') ?? []
    const first = [...numbers].find(number => number.getBoundingClientRect().top >= 0)
    place.current = first && { id: first.id, top: first.getBoundingClientRect().top }
  }
  useBrowserLayoutEffect(() => {
    const kept = place.current
    place.current = undefined
    const number = kept && document.getElementById(kept.id)
    if (kept && number) window.scrollBy(0, number.getBoundingClientRect().top - kept.top)
  }, [page.html, page.verses])

  const otherLanguage = language === 'fr' ? 'en' : 'fr'
  const alternateVersion = ALTERNATE_VERSION[language]
  // The interlinear reading switches its glosses; any other reading switches Bible.
  const alternatePath =
    presentation === 'interlinear'
      ? keep(buildBiblePath({ ...location, passage, gloss: otherLanguage }))
      : page.versionIds.includes(alternateVersion)
        ? keep(
            buildBiblePath({
              ...location,
              versionId: alternateVersion,
              presentation: closestBiblePresentation(alternateVersion, presentation),
              passage,
              gloss: otherLanguage,
            })
          )
        : undefined
  const passageLabel = passage
    ? `:${passage.startVerse}${passage.endVerse ? `-${passage.endVerse}` : ''}`
    : ''
  const chapterPath = (ref: BibleChapterRef) => keep(buildBiblePath({ ...location, ...ref }))
  // Hebrew (and Aramaic) for the Old Testament, Greek for the New.
  const originalLang = book <= 39 ? 'he' : 'grc'
  const textClassName = `resource-prose bible-text bible-text--${presentation} mt-8 ${passage ? 'bible-text--passage' : ''}`
  const textLang = version?.language === 'he-grc' ? undefined : version?.language

  return (
    <ResourceShell
      alternatePath={alternatePath}
      appUrl={buildWebAppBibleUrl({ ...location, passage })}
      section="bible"
      breadcrumbs={bibleBreadcrumbs(page)}
      subHeader={<BibleNavBar page={page} onCommentariesChange={rememberPlace} />}
    >
      <article ref={articleRef}>
        <header>
          <p className="resource-muted text-sm font-medium uppercase tracking-[0.14em]">
            {version ? bibleVersionName(version, language) : versionId}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
            {bookName} {chapter}
            {passageLabel}
          </h1>
        </header>

        {page.html !== undefined ? (
          <div
            className={textClassName}
            lang={textLang}
            dangerouslySetInnerHTML={{ __html: page.html }}
          />
        ) : (
          <div className={textClassName} lang={textLang}>
            {page.commentsBeforeHtml && (
              <div dangerouslySetInnerHTML={{ __html: page.commentsBeforeHtml }} />
            )}
            {page.verses?.map(verse => (
              <div key={verse.number}>
                {verse.headings.map(heading => (
                  <h2 key={heading} className="bible-heading">
                    {heading}
                  </h2>
                ))}
                <div
                  className="interlinear"
                  dir={presentation === 'interlinear' && book <= 39 ? 'rtl' : 'ltr'}
                >
                  <a
                    id={`v${verse.number}`}
                    className="bible-verse-number"
                    href={keep(
                      buildBiblePath({ ...location, passage: { startVerse: verse.number } })
                    )}
                    aria-label={`${bookName} ${chapter}:${verse.number}`}
                  >
                    {verse.number}
                  </a>
                  {verse.words.map((word, index) => (
                    <InterlinearWord
                      key={index}
                      word={word}
                      originalLang={originalLang}
                      direct={presentation === 'interlinear'}
                    />
                  ))}
                </div>
                {verse.commentsHtml && (
                  <div dangerouslySetInnerHTML={{ __html: verse.commentsHtml }} />
                )}
              </div>
            ))}
          </div>
        )}

        {passage && (
          <a
            className="resource-link mt-6 inline-block font-semibold"
            href={keep(`${buildBiblePath(location)}#v${passage.startVerse}`)}
          >
            {t('bible.readChapter').replace('{chapter}', `${bookName} ${chapter}`)}
          </a>
        )}

        <nav className="mt-10 flex justify-between gap-4" aria-label={t('bible.chapterNav')}>
          {page.previous ? (
            <a className="resource-link" href={chapterPath(page.previous)} rel="prev">
              ← {bibleBookName(page.previous.book, language)} {page.previous.chapter}
            </a>
          ) : (
            <span />
          )}
          {page.next && (
            <a className="resource-link" href={chapterPath(page.next)} rel="next">
              {bibleBookName(page.next.book, language)} {page.next.chapter} →
            </a>
          )}
        </nav>

        {page.notes && page.notes.length > 0 && (
          <section className="bible-notes mt-12">
            <h2 className="resource-muted mb-3 text-sm font-semibold uppercase tracking-[0.1em]">
              {t('bible.notes')}
            </h2>
            <ol>
              {page.notes.map(note => (
                <li key={note.id} id={`note-${note.id}`}>
                  {/* The label is text, so the links of the line stay inline targets. */}
                  <span className="font-semibold">
                    {note.id}. {bookName} {chapter}:{note.verse}
                  </span>{' '}
                  <span dangerouslySetInnerHTML={{ __html: note.html }} />{' '}
                  <a
                    className="bible-notes__back"
                    href={`#note-ref-${note.id}`}
                    role="doc-backlink"
                    aria-label={t('bible.note.back').replace(
                      '{verse}',
                      `${bookName} ${chapter}:${note.verse}`
                    )}
                  >
                    ↩
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}

        {page.commentaries.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-3 text-xl font-semibold">
              {t('bible.commentaries').replace('{chapter}', `${bookName} ${chapter}`)}
            </h2>
            <ul className="strong-list">
              {page.commentaries.map(commentary => (
                <li key={commentary.path}>
                  <a className="strong-list__entry" href={commentary.path}>
                    <span className="strong-list__gloss">{commentary.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {version?.copyright && (
          <p className="resource-muted mt-10 text-xs">
            {bibleVersionName(version, language)} — {version.copyright}
          </p>
        )}
      </article>
      {presentation !== 'text' && (
        <StrongPreviewPopover containerRef={articleRef} language={language} />
      )}
      {page.inlineCommentaries.length > 0 && (
        <BibleCommentaryDialog
          containerRef={articleRef}
          language={language}
          book={book}
          chapter={chapter}
        />
      )}
      {page.notes && page.notes.length > 0 && (
        <BibleNotePopover
          containerRef={articleRef}
          notes={page.notes}
          reference={verse => `${bookName} ${chapter}:${verse}`}
        />
      )}
    </ResourceShell>
  )
}
