import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { HTMLViewLinkPayload } from '~common/htmlContentTypes'

export type PreviewSource =
  | {
      kind: 'dictionary'
      work: string
      resourceId?: string
      dictionaryTitle: string
      language: ResourceLanguage
    }
  | { kind: 'nave'; language: ResourceLanguage }
  | { kind: 'strong'; language: ResourceLanguage }

export type ResourcePreviewTarget =
  | {
      kind: 'dictionary'
      word: string
      source: Extract<PreviewSource, { kind: 'dictionary' }>
      title: string
    }
  | { kind: 'nave'; name: string; source: Extract<PreviewSource, { kind: 'nave' }>; title: string }
  | {
      kind: 'strong'
      code: string
      source: Extract<PreviewSource, { kind: 'strong' }>
      title: string
    }

export function parseResourcePreviewLink(
  payload: Pick<HTMLViewLinkPayload, 'href' | 'type'>,
  source: PreviewSource | undefined,
  strongLanguage: ResourceLanguage
): ResourcePreviewTarget | undefined {
  let href: string
  try {
    href = decodeURIComponent(payload.href).trim()
  } catch {
    return
  }
  const strong = /^strong:\/\/([HG]\d+[A-Z]?)$/iu.exec(href)
  if (strong) {
    const code = strong[1].toUpperCase()
    return {
      kind: 'strong',
      code,
      title: code,
      source: {
        kind: 'strong',
        language: source?.kind === 'strong' ? source.language : strongLanguage,
      },
    }
  }
  if (source?.kind === 'nave' && href.startsWith('w=') && href.length > 2) {
    return { kind: 'nave', name: href.slice(2), title: href.slice(2), source }
  }
  if (
    source?.kind === 'dictionary' &&
    href &&
    !/^(?:[a-z][\w+.-]*:|#|\/|v=|w=)/iu.test(href) &&
    !payload.type.includes('verse')
  ) {
    return { kind: 'dictionary', word: href, title: href, source }
  }
}
