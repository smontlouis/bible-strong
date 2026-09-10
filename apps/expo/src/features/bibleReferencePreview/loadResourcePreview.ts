import type { ResourceAccessRegistry } from '~features/resources/resourceAccess'
import type { ResourcePreviewTarget } from './resourceTarget'

export async function loadResourcePreview(
  target: ResourcePreviewTarget,
  resources: Pick<ResourceAccessRegistry, 'dictionary' | 'nave' | 'strongLexicon'>
) {
  if (target.kind === 'dictionary') {
    const entry = await resources.dictionary.loadItem(
      target.word,
      target.source.language,
      target.source.work
    )
    return entry ? { html: entry.definition } : null
  }
  if (target.kind === 'nave') {
    const entry = await resources.nave.loadItem(target.name, target.source.language)
    return entry ? { html: entry.description } : null
  }
  const entry = await resources.strongLexicon.loadEntry(
    { kind: 'dstrong', code: target.code },
    target.source.language
  )
  return entry
    ? {
        html: entry.definitionHtml ?? '',
        original: entry.original,
        transliteration: entry.transliteration,
        gloss: entry.gloss,
      }
    : null
}
