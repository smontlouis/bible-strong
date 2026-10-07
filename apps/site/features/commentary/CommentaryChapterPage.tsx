import { bibleBookName } from '../bible/bibleBooks'
import Pagination from '../resources/Pagination'
import ResourceShell from '../resources/ResourceShell'
import type { CommentaryChapterPageData } from './commentary.functions'
import { commentaryChapterBreadcrumbs } from './commentaryBreadcrumbs'
import type { CommentaryChapterRef } from './commentaryCoverage'
import {
  buildCommentaryChapterPath,
  buildCommentaryIndexPath,
  buildWebAppCommentaryUrl,
  commentarySectionAnchor,
  otherResourceLanguage,
} from './commentaryRoutes'
import { commentaryVerseRange, groupCommentarySectionsByRange } from './commentarySections'
import { commentaryMessages } from './messages'

const Prose = ({ id, html }: { id?: string; html: string }) => (
  <div
    id={id}
    className="commentary-section resource-prose"
    dangerouslySetInnerHTML={{ __html: html }}
  />
)

/**
 * `/commentary/:language/:resource/:book/:chapter` — every section of the chapter under
 * the verses it comments, each at the anchor its section address resolves to.
 */
export default function CommentaryChapterPage({ page }: { page: CommentaryChapterPageData }) {
  const { language, commentary, book, chapter } = page
  const t = commentaryMessages(language)
  const otherLanguage = otherResourceLanguage(language)
  const location = { language, resource: commentary.id, book, chapter }
  const reference = `${bibleBookName(book, language)} ${chapter}`
  const chapterPath = (ref: CommentaryChapterRef) =>
    buildCommentaryChapterPath({ ...location, ...ref })
  // On a chapter read over several pages, the sequence is the one of its pages.
  const chapterRel = (rel: 'prev' | 'next') => (page.pageCount > 1 ? undefined : rel)
  const groups = groupCommentarySectionsByRange(page.sections).map(group => {
    const range = commentaryVerseRange(group)
    return {
      ...group,
      anchor: commentarySectionAnchor(group.sections[0].slug),
      // The reference in the title, the verses alone where the chapter is already named.
      title: range ? `${reference}:${range}` : t('commentary.chapter.introduction'),
      label: range ?? t('commentary.chapter.introduction'),
    }
  })

  return (
    <ResourceShell
      // The same chapter when the work comments it in the other language, otherwise the
      // commentaries of that language.
      alternatePath={
        page.counterpart
          ? buildCommentaryChapterPath({
              ...location,
              language: otherLanguage,
              resource: page.counterpart,
            })
          : buildCommentaryIndexPath(otherLanguage)
      }
      appUrl={buildWebAppCommentaryUrl(location)}
      section="commentary"
      breadcrumbs={commentaryChapterBreadcrumbs(page)}
    >
      <article lang={language}>
        <header>
          <h1>
            <span className="resource-muted block text-sm font-medium uppercase tracking-[0.14em]">
              {commentary.title}
            </span>
            <span className="mt-3 block font-serif text-4xl leading-tight md:text-5xl">
              {reference}
            </span>
          </h1>
          <p className="resource-muted mt-3 text-sm">
            {commentary.author}
            {page.pageCount > 1 &&
              ` · ${t('commentary.chapter.page', { page: page.page, count: page.pageCount })}`}
          </p>
          {page.biblePath && (
            <a className="resource-link mt-3 inline-block py-1 text-sm font-semibold" href={page.biblePath}>
              {t('commentary.chapter.readBible', { reference })}
            </a>
          )}
        </header>

        {groups.length > 1 && (
          <nav className="mt-8" aria-label={t('commentary.chapter.verses')}>
            <ul className="flex flex-wrap gap-2">
              {groups.map(group => (
                <li key={group.anchor}>
                  <a className="resource-chip" href={`#${group.anchor}`}>
                    {group.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {groups.map(group => (
          <section key={group.anchor} id={group.anchor} className="commentary-range mt-12">
            <h2 className="mb-4 text-xl font-semibold">{group.title}</h2>
            {group.sections.map((section, index) => (
              <Prose
                key={section.slug}
                // The first section is reached at the heading of its verses.
                id={index === 0 ? undefined : commentarySectionAnchor(section.slug)}
                html={section.html}
              />
            ))}
          </section>
        ))}

        <Pagination
          current={page.page}
          pageCount={page.pageCount}
          hrefFor={number => buildCommentaryChapterPath(location, number)}
        />

        <nav className="mt-10 flex justify-between gap-4" aria-label={t('commentary.chapter.nav')}>
          {page.previous ? (
            <a className="resource-link" href={chapterPath(page.previous)} rel={chapterRel('prev')}>
              ← {bibleBookName(page.previous.book, language)} {page.previous.chapter}
            </a>
          ) : (
            <span />
          )}
          {page.next && (
            <a className="resource-link" href={chapterPath(page.next)} rel={chapterRel('next')}>
              {bibleBookName(page.next.book, language)} {page.next.chapter} →
            </a>
          )}
        </nav>

        <p className="resource-muted mt-10 text-xs">
          {commentary.title} — {commentary.author}. {commentary.rights}
        </p>
      </article>
    </ResourceShell>
  )
}
