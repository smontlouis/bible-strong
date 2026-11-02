import type {
  StudyLinkDto,
  StudyLinkKind,
  StudyLinkRole,
  StudyLinksResponseDto,
} from '@bible-strong/resource-domain/contracts/studyLinksContract'
import type { ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import { entityPortraitUrl, readAtlasPortraitCatalog } from '../atlas/atlasPortraits'
import { buildAtlasEntityPath } from '../atlas/atlasRoutes'
import { buildDictionaryEntryPath } from '../dictionary/dictionaryRoutes'
import { buildNavePath } from '../nave/naveRoutes'
import { buildTimelineEventPath } from '../timeline/timelineRoutes'

export type StudyLinkItem = {
  kind: StudyLinkKind
  key: string
  label: string
  detail?: string
  role?: StudyLinkRole
  path: string
  /** The portrait of a person or a place, when it has one. */
  picture?: string
}

export const studyLinkPath = (link: StudyLinkDto, language: ResourceLanguage): string => {
  switch (link.kind) {
    case 'entity':
      return buildAtlasEntityPath(language, link.key)
    case 'nave':
      return buildNavePath(language, link.key)
    case 'timeline':
      return buildTimelineEventPath(language, link.key)
    case 'dictionary': {
      const separator = link.key.lastIndexOf(':')
      return buildDictionaryEntryPath({
        language,
        work: link.key.slice(0, separator),
        entryId: Number(link.key.slice(separator + 1)),
        word: link.label,
      })
    }
  }
}

/**
 * What a chip says after its title. A dictionary article leads to the other dictionaries of its
 * word, so its work only tells apart two articles of one name.
 */
export const studyLinkDetail = (
  link: Pick<StudyLinkItem, 'kind' | 'label' | 'detail'>,
  links: readonly Pick<StudyLinkItem, 'label'>[]
): string | undefined => {
  if (link.kind === 'timeline') return link.detail
  if (link.kind !== 'dictionary') return undefined
  const name = link.label.toLocaleLowerCase()
  return links.filter(other => other.label.toLocaleLowerCase() === name).length > 1
    ? link.detail
    : undefined
}

/** The links complete a page: one that cannot read them is shown without them. */
export const readStudyLinksOf = async (
  kind: StudyLinkKind,
  key: string,
  language: ResourceLanguage
): Promise<StudyLinkItem[]> => {
  const response = await readResource<StudyLinksResponseDto>(
    `/v1/study-links/${kind}/${encodeURIComponent(key)}`,
    { language }
  ).catch(() => undefined)
  const links = response?.links ?? []
  const catalog = links.some(link => link.kind === 'entity')
    ? await readAtlasPortraitCatalog().catch(() => undefined)
    : undefined
  return links.map(link => {
    const portrait = link.kind === 'entity' ? catalog?.entities[link.key] : undefined
    return {
      kind: link.kind,
      key: link.key,
      label: link.label,
      detail: link.detail,
      role: link.role,
      path: studyLinkPath(link, language),
      ...(portrait ? { picture: entityPortraitUrl(link.key, portrait.hash, 'w256') } : {}),
    }
  })
}
