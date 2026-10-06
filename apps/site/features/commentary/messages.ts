import type { ResourceLanguage } from '../resources/publicSite'

const fr = {
  'commentary.index.title': 'Commentaires bibliques',
  'commentary.index.intro':
    'Lisez la Bible avec ceux qui l’ont expliquée, des Pères de l’Église aux commentateurs d’aujourd’hui. Chaque commentaire se lit chapitre par chapitre, à côté du texte biblique.',
  'commentary.index.count': '{count} commentaires en français',
  'commentary.index.head.title':
    'Commentaires bibliques en français, chapitre par chapitre | Bible Strong',
  'commentary.index.head.description':
    'Lisez la Bible avec Matthew Henry, Barnes, Clarke, Augustin, Chrysostome ou la Bible annotée : les commentaires bibliques en français, par chapitre.',
  'commentary.resource.summary': '{books} livres, {chapters} chapitres commentés.',
  'commentary.resource.summary.oneBook': '1 livre, {chapters} chapitres commentés.',
  'commentary.resource.start': 'Commencer la lecture',
  'commentary.resource.otherLanguage': 'Ce commentaire existe aussi en anglais',
  'commentary.resource.head.title': '{title} – commentaire biblique en ligne | Bible Strong',
  'commentary.testament.old': 'Ancien Testament',
  'commentary.testament.new': 'Nouveau Testament',
  'commentary.chapters': '{count} chapitres',
  'commentary.chapter': '1 chapitre',
  'commentary.chapter.head.title': '{reference} – {title} | Commentaire biblique',
  'commentary.chapter.readBible': 'Lire {reference} dans la Bible',
  'commentary.chapter.verses': 'Versets commentés',
  'commentary.chapter.introduction': 'Introduction',
  'commentary.chapter.nav': 'Chapitres précédent et suivant',
  'commentary.chapter.page': 'Page {page} sur {count}',
  'commentary.page': 'page {page}',
} as const

type CommentaryMessageKey = keyof typeof fr

const en: Record<CommentaryMessageKey, string> = {
  'commentary.index.title': 'Bible commentaries',
  'commentary.index.intro':
    'Read the Bible alongside those who explained it, from the Church Fathers to present-day commentators. Each commentary reads chapter by chapter, next to the Bible text.',
  'commentary.index.count': '{count} commentaries in English',
  'commentary.index.head.title': 'Bible commentaries in English, chapter by chapter | Bible Strong',
  'commentary.index.head.description':
    'Read the Bible with Matthew Henry, Calvin, Barnes, Clarke, Keil & Delitzsch, Rashi and more: classic Bible commentaries in English, chapter by chapter.',
  'commentary.resource.summary': '{books} books, {chapters} chapters commented.',
  'commentary.resource.summary.oneBook': '1 book, {chapters} chapters commented.',
  'commentary.resource.start': 'Start reading',
  'commentary.resource.otherLanguage': 'This commentary is also available in French',
  'commentary.resource.head.title': '{title} – Bible commentary online | Bible Strong',
  'commentary.testament.old': 'Old Testament',
  'commentary.testament.new': 'New Testament',
  'commentary.chapters': '{count} chapters',
  'commentary.chapter': '1 chapter',
  'commentary.chapter.head.title': '{reference} – {title} | Bible commentary',
  'commentary.chapter.readBible': 'Read {reference} in the Bible',
  'commentary.chapter.verses': 'Verses commented',
  'commentary.chapter.introduction': 'Introduction',
  'commentary.chapter.nav': 'Previous and next chapters',
  'commentary.chapter.page': 'Page {page} of {count}',
  'commentary.page': 'page {page}',
}

const MESSAGES: Record<ResourceLanguage, Record<CommentaryMessageKey, string>> = { fr, en }

/**
 * The interface strings of the commentary pages, in the language of the page rather than
 * the locale of the site: a French commentary reads in French wherever it is linked from.
 * Placeholders are written `{name}`, as in the shared locale files.
 */
export const commentaryMessages =
  (language: ResourceLanguage) =>
  (key: CommentaryMessageKey, values: Record<string, string | number> = {}): string =>
    Object.entries(values).reduce(
      (message, [name, value]) => message.replace(`{${name}}`, String(value)),
      MESSAGES[language][key]
    )
