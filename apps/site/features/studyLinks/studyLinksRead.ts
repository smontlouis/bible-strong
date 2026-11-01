import type {
  StudyLinkDto,
  StudyLinkKind,
  StudyLinksResponseDto,
} from '@bible-strong/resource-domain/contracts/studyLinksContract'
import type { ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import { buildAtlasEntityPath } from '../atlas/atlasRoutes'
import { buildDictionaryEntryPath } from '../dictionary/dictionaryRoutes'
import { buildNavePath } from '../nave/naveRoutes'
import { buildTimelineEventPath } from '../timeline/timelineRoutes'

export type StudyLinkItem = {
  kind: StudyLinkKind
  label: string
  detail?: string
  path: string
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
  return (response?.links ?? []).map(link => ({
    kind: link.kind,
    label: link.label,
    detail: link.detail,
    path: studyLinkPath(link, language),
  }))
}
