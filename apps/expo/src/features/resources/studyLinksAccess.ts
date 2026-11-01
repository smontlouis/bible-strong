import {
  StudyLinksResponseDto,
  type StudyLinkKind,
  type StudyLinkLanguage,
  type StudyLinkView,
} from '@bible-strong/resource-domain/contracts/studyLinksContract'
import * as Schema from 'effect/Schema'

export type StudyLinksSubject = { kind: StudyLinkKind; key: string }

export type StudyLinksAccess = {
  load: (
    subject: StudyLinksSubject,
    language: StudyLinkLanguage,
    signal?: AbortSignal
  ) => Promise<StudyLinkView[]>
}

const decode = Schema.decodeUnknownSync(StudyLinksResponseDto)

// A page reads its links on the way: without them it only misses a section, so no failure here
// ever reaches the reader.
export const createHttpStudyLinksAccess = ({
  baseUrl,
  fetcher = fetch,
}: {
  baseUrl: string
  fetcher?: typeof fetch
}): StudyLinksAccess => ({
  load: async ({ kind, key }, language, signal) => {
    try {
      const response = await fetcher(
        `${baseUrl.replace(/\/$/, '')}/v1/study-links/${kind}/${encodeURIComponent(key)}?language=${language}`,
        { headers: { accept: 'application/json' }, signal }
      )
      if (!response.ok) return []
      return [...decode(await response.json()).links] as StudyLinkView[]
    } catch {
      return []
    }
  },
})

export const unavailableStudyLinksAccess: StudyLinksAccess = { load: async () => [] }

export const createHybridStudyLinksAccess = ({
  offline,
  online,
  isInstalled,
}: {
  offline: StudyLinksAccess
  online: StudyLinksAccess
  isInstalled: () => Promise<boolean>
}): StudyLinksAccess => ({
  load: async (subject, language, signal) => {
    if (await isInstalled()) {
      try {
        return await offline.load(subject, language, signal)
      } catch {
        return online.load(subject, language, signal)
      }
    }
    return online.load(subject, language, signal)
  },
})
