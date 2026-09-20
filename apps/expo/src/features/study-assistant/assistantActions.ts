import { parseAssistantAction, type AssistantAction } from '@bible-strong/ai-contract/contract'
import { createPassageTab } from '~features/app-switcher/tabOpenRequest'
import { getBook } from '~helpers/bibleBookCatalog'
import generateUUID from '~helpers/generateUUID'
import verseToReference from '~helpers/verseToReference'
import i18n from '~i18n'
import type { TabItem } from '~state/tabs'
import { DEFAULT_BIBLE_VERSION_FILTER } from '~state/searchVersionFilter'

export function createTabForAssistantAction(value: AssistantAction): TabItem | undefined {
  let action: AssistantAction
  try {
    action = parseAssistantAction(value)
  } catch {
    return undefined
  }
  if (action.tabType === 'bible' || action.tabType === 'compare')
    return createPassageTab({ tabType: action.tabType, ...action.target })

  const base = { id: generateUUID(), isRemovable: true }
  switch (action.tabType) {
    case 'strong': {
      const { code, identityKind } = action.target
      return {
        ...base,
        type: 'strong',
        title: code || i18n.t('Lexique'),
        data: code
          ? {
              book: code.startsWith('G') ? 40 : 1,
              reference: code,
              identityCode: code,
              identityKind: identityKind || 'strong',
            }
          : {},
      }
    }
    case 'dictionary': {
      const { language, work, entryId, word } = action.target
      return {
        ...base,
        type: 'dictionary',
        title: word || i18n.t('tabs.dictionary'),
        data: {
          language,
          work,
          entryId,
          word,
          directory: !work,
        },
      }
    }
    case 'nave': {
      const { language, normalizedName } = action.target
      return {
        ...base,
        type: 'nave',
        title: normalizedName || i18n.t('tabs.nave'),
        data: {
          language,
          name_lower: normalizedName,
          name: normalizedName,
        },
      }
    }
    case 'commentary': {
      const { book, chapter, verse } = action.target
      if (!getBook(book) || chapter > getBook(book)!.Chapitres) return undefined
      return {
        ...base,
        type: 'commentary',
        title: verseToReference({ bookNum: book, chapterNum: chapter, verses: [verse] }),
        data: { verse: `${book}-${chapter}-${verse}` },
      }
    }
    case 'commentary-resource': {
      const { resourceId, language, book, chapter, sectionId } = action.target
      if (!getBook(book) || chapter > getBook(book)!.Chapitres) return undefined
      return {
        ...base,
        type: 'commentary-resource',
        title: verseToReference({ bookNum: book, chapterNum: chapter }),
        data: {
          projectionId: `${resourceId}:${language}`,
          book,
          chapter,
          sectionId,
        },
      }
    }
    case 'timeline':
      return {
        ...base,
        type: 'timeline',
        title: i18n.t('Chronologie de la Bible'),
        data: {
          language: action.target.language,
          eventSlug: action.target.eventSlug,
        },
      }
    case 'search':
      return {
        ...base,
        type: 'search',
        title: action.target.query,
        data: {
          searchValue: action.target.query,
          filters: {
            section: '',
            canon: '',
            book: 0,
            selectedVersion: DEFAULT_BIBLE_VERSION_FILTER,
            sortOrder: 'relevance',
            itemFilters: {
              passages: true,
              notes: false,
              links: false,
              studies: false,
              strong: false,
              dictionary: false,
              nave: false,
              commentary: false,
              plan: false,
              timeline: false,
            },
          },
        },
      }
    case 'plan':
      // PlanTabScreen fetches only the public plans collection with enroll:false.
      // No participation, reminder or completion state is accepted from the model.
      return {
        ...base,
        type: 'plan',
        title: i18n.t('Plans & Méditations'),
        data: {
          planId: action.target.planId,
          readingSliceId: action.target.readingId,
        },
      }
  }
}
