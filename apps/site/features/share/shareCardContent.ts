import { loadBiblePage } from '../bible/bible.functions'
import { bibleBookName } from '../bible/bibleBooks'
import { bibleVersionName, findBibleVersion } from '../bible/bibleVersions'
import { loadStrongPreview } from '../strong/strong.functions'
import { displayStrongNumber, strongLexicalLanguage } from '../strong/strongRoutes'
import { loadTimelinePreview } from '../timeline/timeline.functions'
import { formatTimelineDates } from '../timeline/timelineDates'
import type { ShareCardContent } from './ShareCard'
import { shareCardExcerpt, shareCardLine, shareCardVerse } from './shareCardText'

const LABELS = {
  fr: { strong: 'Strong', hebrew: 'Hébreu', greek: 'Grec', timeline: 'Chronologie', verses: 'versets' },
  en: { strong: 'Strong’s', hebrew: 'Hebrew', greek: 'Greek', timeline: 'Timeline', verses: 'verses' },
} as const

// The renderer reads JPEG and PNG, not the WebP copies the pages show: a card takes the
// original until the media host holds a copy made for it.
const readablePicture = (webp: string | undefined): string | undefined => {
  const original = webp?.replace('/w1200/', '/original/').replace(/\.webp$/u, '')
  return original && /\.(?:jpe?g|png)$/iu.test(original) ? original : undefined
}

// The lexicon sometimes writes a transliteration twice over ("shâlôm shâlôm").
const oneSpelling = (transliteration: string): string => {
  const spellings = shareCardLine(transliteration).split(' ')
  return new Set(spellings).size === 1 ? spellings[0] : spellings.join(' ')
}

/**
 * What the share image of a public page shows, read from the page's own loaders so that the
 * image and the page never disagree. A path that names no page with a card of its own gets
 * the default card.
 */
export const loadShareCardContent = async (path: string): Promise<ShareCardContent> => {
  const [section, ...rest] = path.split('/').filter(Boolean)

  if (section === 'bible') {
    const page = await loadBiblePage({ data: { path: rest.join('/') } })
    const { language, passage, versionId } = page
    const book = bibleBookName(page.book, language)
    if (page.study && passage) {
      return {
        kind: 'text',
        kicker: `${book} ${page.chapter}:${passage.startVerse}`,
        chip: versionId,
        text: shareCardVerse(page.study.text),
      }
    }
    const version = findBibleVersion(versionId)
    return {
      kind: 'title',
      kicker: version ? bibleVersionName(version, language) : versionId,
      chip: versionId,
      title: `${book} ${page.chapter}`,
      large: true,
    }
  }

  if (section === 'strong' && rest.length === 2) {
    const [language, code] = rest
    const entry = await loadStrongPreview({ data: { language, code } })
    const labels = LABELS[language === 'en' ? 'en' : 'fr']
    return {
      kind: 'word',
      kicker: `${labels.strong} ${displayStrongNumber(entry.code)}`,
      chip: labels[strongLexicalLanguage(entry.code)],
      original: entry.original,
      transliteration: oneSpelling(entry.transliteration),
      gloss: entry.gloss,
      facts: entry.morphology,
    }
  }

  if (section === 'timeline' && rest.length === 2) {
    const [language, slug] = rest
    const event = await loadTimelinePreview({ data: { language, slug } })
    const pageLanguage = language === 'en' ? 'en' : 'fr'
    const picture = readablePicture(event.image)
    return {
      kind: 'title',
      kicker: LABELS[pageLanguage].timeline,
      chip: formatTimelineDates(event.dates, pageLanguage),
      title: event.title,
      excerpt: shareCardExcerpt(event.summary, picture !== undefined),
      picture,
    }
  }

  return { kind: 'default' }
}
