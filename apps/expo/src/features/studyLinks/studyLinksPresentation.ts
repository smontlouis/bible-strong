import type {
  StudyLinkKind,
  StudyLinkLanguage,
  StudyLinkView,
} from '@bible-strong/resource-domain/contracts/studyLinksContract'
import { createDictionaryInternalLinkRoute } from '~features/dictionnary/dictionaryInternalNavigation'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'

export const STUDY_LINK_SECTIONS: readonly { kind: StudyLinkKind; titleKey: string }[] = [
  { kind: 'entity', titleKey: 'studyLinks.entities' },
  { kind: 'nave', titleKey: 'studyLinks.nave' },
  { kind: 'dictionary', titleKey: 'studyLinks.dictionaries' },
  { kind: 'timeline', titleKey: 'studyLinks.timeline' },
]

/** A section shows this many links before it offers the rest. */
export const STUDY_LINKS_SHOWN = 5

const splitDictionaryKey = (key: string) => {
  const separator = key.lastIndexOf(':')
  return { work: key.slice(0, separator), entryId: key.slice(separator + 1) }
}

export const studyLinkRoute = (link: StudyLinkView, language: StudyLinkLanguage) => {
  switch (link.kind) {
    case 'entity':
      return createStrongDetailRoute('entity', {}, { entityKey: link.key })
    case 'nave':
      return { pathname: '/nave-detail', params: { name_lower: link.key, name: link.label } }
    case 'dictionary': {
      const { work, entryId } = splitDictionaryKey(link.key)
      const route = createDictionaryInternalLinkRoute(link.label, {
        work,
        dictionaryTitle: link.detail ?? link.label,
        language,
      })
      return { ...route, params: { ...route.params, entryId } }
    }
    case 'timeline':
      return { pathname: '/event', params: { slug: link.key } }
  }
}
