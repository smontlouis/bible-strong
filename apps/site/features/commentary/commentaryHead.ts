import { bibleBookName } from '../bible/bibleBooks'
import { truncateText } from '../resources/editorialHtml'
import type { ResourceLanguage } from '../resources/publicSite'
import { buildResourceHead } from '../resources/resourceHead'
import type { CommentaryChapterPageData, CommentaryPageData } from './commentary.functions'
import { commentaryBreadcrumbs, commentaryChapterBreadcrumbs } from './commentaryBreadcrumbs'
import {
  buildCommentaryChapterPath,
  buildCommentaryIndexPath,
  buildCommentaryPath,
  otherResourceLanguage,
} from './commentaryRoutes'
import { commentaryMessages } from './messages'
import { afterReference, shareCardVerse } from '../share/shareCardText'

const DESCRIPTION_LENGTH = 155

/**
 * Head of `/commentary/:language`. Each language lists its own commentaries; the two pages
 * are the same entry of the site in each language.
 */
export const buildCommentaryIndexHead = (language: ResourceLanguage) => {
  const t = commentaryMessages(language)
  return buildResourceHead({
    title: t('commentary.index.head.title'),
    description: t('commentary.index.head.description'),
    path: buildCommentaryIndexPath(language),
    language,
    alternates: { fr: buildCommentaryIndexPath('fr'), en: buildCommentaryIndexPath('en') },
    ogType: 'website',
    shareCard: {
      kind: 'title',
      title: language === 'fr' ? 'Commentaires bibliques' : 'Bible commentaries',
    },
  })
}

/** Head of `/commentary/:language/:resource`. */
export const buildCommentaryHead = ({ language, commentary, counterpart }: CommentaryPageData) =>
  buildResourceHead({
    title: commentaryMessages(language)('commentary.resource.head.title', {
      title: commentary.title,
    }),
    description: truncateText(
      commentary.description || `${commentary.title} — ${commentary.author}`,
      DESCRIPTION_LENGTH
    ),
    path: buildCommentaryPath(language, commentary.id),
    language,
    // Only a work published in both languages has a counterpart.
    alternates: counterpart
      ? {
          [language]: buildCommentaryPath(language, commentary.id),
          [otherResourceLanguage(language)]: buildCommentaryPath(
            otherResourceLanguage(language),
            counterpart
          ),
        }
      : undefined,
    breadcrumbs: commentaryBreadcrumbs(language, commentary),
    ogType: 'website',
    shareCard: {
      kind: 'title',
      kicker: language === 'fr' ? 'Commentaire biblique' : 'Bible commentary',
      title: commentary.title,
      facts: commentary.author,
    },
  })

/**
 * Head of a chapter page. Every numbered page is indexable under its own address; the two
 * languages of a work only line up on the first one.
 */
export const buildCommentaryChapterHead = (page: CommentaryChapterPageData) => {
  const { language, commentary, book, chapter } = page
  const t = commentaryMessages(language)
  const location = { language, resource: commentary.id, book, chapter }
  const numbered = page.page > 1
  const reference = `${bibleBookName(book, language)} ${chapter}`
  return buildResourceHead({
    title: t('commentary.chapter.head.title', {
      reference,
      title: `${commentary.title}${numbered ? ` – ${t('commentary.page', { page: page.page })}` : ''}`,
    }),
    description: page.description,
    path: buildCommentaryChapterPath(location, page.page),
    language,
    alternates:
      page.counterpart && !numbered
        ? {
            [language]: buildCommentaryChapterPath(location),
            [otherResourceLanguage(language)]: buildCommentaryChapterPath({
              ...location,
              language: otherResourceLanguage(language),
              resource: page.counterpart,
            }),
          }
        : undefined,
    breadcrumbs: commentaryChapterBreadcrumbs(page),
    // A commentary is read, not named: the card opens on what it says of the chapter.
    shareCard: {
      kind: 'text',
      kicker: reference,
      chip: commentary.author || commentary.title,
      text: shareCardVerse(afterReference(page.description, reference)),
    },
  })
}
