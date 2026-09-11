import { getDefaultDictionaryWork } from '~features/resources/dictionaryAccess'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { Platform } from 'react-native'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import verseToReference from '~helpers/verseToReference'
import type { PreviewRequest } from './state'

/** Individual linked reading content can be previewed on Web. */
export function createReaderPreview(
  endpoint: RelationEndpoint,
  version: string,
  noteTitle: string,
  open: () => void,
  languages: { nave: ResourceLanguage; dictionary: ResourceLanguage } = {
    nave: 'fr',
    dictionary: 'fr',
  }
): PreviewRequest | undefined {
  if (Platform.OS !== 'web') return
  if (endpoint.type === 'externalLink')
    return {
      kind: 'link',
      linkId: endpoint.linkId,
      title: endpoint.labelFallback || endpoint.label || endpoint.url,
      open,
    }
  if (endpoint.type === 'note')
    return { kind: 'note', noteId: endpoint.noteId, title: noteTitle, open }
  if (endpoint.type === 'study')
    return {
      kind: 'study',
      studyId: endpoint.studyId,
      title: endpoint.labelFallback || endpoint.label || '',
      open,
    }
  if (endpoint.type === 'nave' || endpoint.type === 'dictionary') {
    const language =
      endpoint.resourceLanguage === 'fr' || endpoint.resourceLanguage === 'en'
        ? endpoint.resourceLanguage
        : languages[endpoint.type === 'nave' ? 'nave' : 'dictionary']
    if (endpoint.type === 'nave')
      return {
        kind: 'nave',
        name: endpoint.nameLower,
        title: endpoint.labelFallback || endpoint.nameLower,
        source: { kind: 'nave', language },
        open,
      }
    const work = getDefaultDictionaryWork(language)
    return {
      kind: 'dictionary',
      word: endpoint.word,
      title: endpoint.word,
      source: {
        kind: 'dictionary',
        language,
        work,
        dictionaryTitle:
          work === 'westphal'
            ? 'Dictionnaire encyclopédique de la Bible'
            : work === 'easton-webster'
              ? 'Easton’s Bible Dictionary & Webster’s 1828 Dictionary'
              : work,
      },
      open,
    }
  }
  if (endpoint.type !== 'verse' || !endpoint.verseKeys.length) return
  const selections = [...new Set(endpoint.verseKeys)].map(key => {
    const [book, chapter, verse] = key.split('-').map(Number)
    return { book, chapter, start: verse, end: verse }
  })
  if (selections.some(s => [s.book, s.chapter, s.start].some(n => !Number.isInteger(n) || n < 1)))
    return
  return {
    kind: 'bible',
    title: verseToReference(Object.fromEntries(endpoint.verseKeys.map(key => [key, true]))),
    selections,
    version: endpoint.version || version,
    open,
  }
}
