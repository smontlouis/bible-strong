import type { ReactNode } from 'react'
import { useI18n } from '@/locales'
import type { ResourceLanguage } from '../resources/publicSite'
import type { BibleVerseStudy as VerseStudy } from './bible.functions'
import type { VerseQuote } from './bibleVerseStudy'

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mt-12">
    <h2 className="mb-4 text-xl font-semibold">{title}</h2>
    {children}
  </section>
)

/** Passages quoted one under the other, each a link to its own page. */
const Quotes = ({ quotes, lang }: { quotes: readonly VerseQuote[]; lang?: string }) => (
  <ul className="verse-quotes">
    {quotes.map(quote => (
      <li key={quote.path}>
        <a className="verse-quotes__quote" href={quote.path}>
          <span className="verse-quotes__label">{quote.label}</span>
          <span className="verse-quotes__text" lang={lang}>
            {quote.text}
          </span>
        </a>
      </li>
    ))}
  </ul>
)

/**
 * What a verse is studied with, under the verse itself: other Bibles, the verses around it,
 * its words in the original language, the passages it is read with, how commentaries begin
 * on it, and the topics and dictionary articles that name it. A part with nothing to show
 * is left out.
 */
export default function BibleVerseDetails({
  study,
  reference,
  chapterLabel,
  chapterPath,
  language,
  textLang,
  originalLang,
}: {
  study: VerseStudy
  /** The verse as a reader names it: `Jean 3:16`. */
  reference: string
  /** The chapter the verse belongs to: `Jean 3`. */
  chapterLabel: string
  chapterPath: string
  language: ResourceLanguage
  /** The language of the Bible being read, which its quotes are written in. */
  textLang?: string
  originalLang: string
}) {
  const t = useI18n()
  const title = (key: Parameters<typeof t>[0]) => t(key).replace('{verse}', reference)
  const { context } = study

  return (
    <>
      {study.versions.length > 0 && (
        <Section title={title('bible.verse.versions')}>
          <Quotes quotes={study.versions} lang={language} />
        </Section>
      )}

      {(context.before.length > 0 || context.after.length > 0) && (
        <Section title={title('bible.verse.context')}>
          <p className="verse-context" lang={textLang}>
            {context.before.map(verse => (
              <a key={verse.verse} className="verse-context__verse" href={verse.path}>
                <span className="verse-context__number">{verse.verse}</span>
                {verse.text}{' '}
              </a>
            ))}
            <strong className="verse-context__current">{study.text}</strong>{' '}
            {context.after.map(verse => (
              <a key={verse.verse} className="verse-context__verse" href={verse.path}>
                <span className="verse-context__number">{verse.verse}</span>
                {verse.text}{' '}
              </a>
            ))}
          </p>
          <a className="resource-link mt-4 inline-block text-sm font-semibold" href={chapterPath}>
            {t('bible.readChapter').replace('{chapter}', chapterLabel)}
          </a>
        </Section>
      )}

      {(study.words.length > 0 || study.original) && (
        <Section title={title('bible.verse.words')}>
          {study.original && (
            <p className="verse-original">
              <span className="font-serif text-2xl" lang={originalLang} dir="auto">
                {study.original.text}
              </span>
              <a
                className="resource-link mt-2 block text-sm font-semibold"
                href={study.original.path}
              >
                {t('bible.verse.interlinear')}
              </a>
            </p>
          )}
          {study.wordsVersion && (
            <p className="resource-muted mb-3 mt-4 text-sm">
              {t('bible.verse.wordsFrom').replace('{version}', study.wordsVersion)}
            </p>
          )}
          {study.words.length > 0 && (
            <ul className="verse-words">
              {study.words.map(word => (
                <li key={word.code}>
                  <a className="verse-words__word" href={word.path} data-strong={word.code}>
                    <span className="verse-words__text">{word.word ?? '·'}</span>
                    <span className="verse-words__original" lang={originalLang} dir="auto">
                      {word.original}
                    </span>
                    <span className="verse-words__gloss">
                      <span className="italic">{word.transliteration}</span> · {word.gloss}
                    </span>
                    <span className="verse-words__code">{word.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {study.crossReferences.length > 0 && (
        <Section title={title('bible.verse.crossReferences')}>
          <Quotes quotes={study.crossReferences} lang={textLang} />
        </Section>
      )}

      {study.comments.length > 0 && (
        <Section title={title('bible.verse.comments')}>
          <ul className="verse-comments">
            {study.comments.map(comment => (
              <li key={comment.commentary}>
                {/* A plain link to the comment; with scripting, the dialog reads it whole. */}
                <a
                  className="verse-comments__comment"
                  href={comment.path}
                  data-commentary={comment.commentary}
                  data-section={comment.section}
                >
                  <span className="bible-comment__source">
                    {comment.title} · {comment.verses}
                  </span>
                  <span className="verse-comments__excerpt">{comment.excerpt}</span>
                  <span className="verse-comments__more">{t('bible.verse.readComment')}</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {study.topics.length > 0 && (
        <Section title={title('bible.verse.topics')}>
          <ul className="flex flex-wrap gap-2">
            {study.topics.map(topic => (
              <li key={topic.path}>
                <a className="resource-chip" href={topic.path}>
                  {topic.name}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {study.dictionary.length > 0 && (
        <Section title={title('bible.verse.dictionary')}>
          <ul className="flex flex-wrap gap-2">
            {study.dictionary.map(entry => (
              <li key={entry.path}>
                <a className="resource-chip" href={entry.path}>
                  {entry.word}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
