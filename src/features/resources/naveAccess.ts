import loadNaveByLetter from '~helpers/loadNaveByLetter'
import loadNaveByRandom from '~helpers/loadNaveByRandom'
import loadNaveBySearch from '~helpers/loadNaveBySearch'
import loadNaveByVerset from '~helpers/loadNaveByVerset'
import loadNaveItem from '~helpers/loadNaveItem'
import { mapLocalResourceError, unwrapLocalResourceResult } from './resourceAccessError'
import { getLocalResourceAvailability } from './resourceAvailability'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { ResourceAvailability } from './resourceModel'

export type NaveTopicSummary = {
  normalizedName: string
  name: string
  initial: string
}

export type NaveTopic = NaveTopicSummary & { description: string }

export type NaveTopicReference = {
  name: string
  normalizedName: string
}

export type NaveVerseTopics = [NaveTopicReference[] | undefined, NaveTopicReference[] | undefined]

export type NaveAccess = {
  getAvailability?: (language: ResourceLanguage) => Promise<ResourceAvailability>
  listByLetter: (letter: string) => Promise<NaveTopicSummary[]>
  search: (searchValue: string) => Promise<NaveTopicSummary[]>
  loadItem: (nameLower: string) => Promise<NaveTopic | undefined>
  loadByVerse: (verse: string) => Promise<NaveVerseTopics>
  loadRandom: () => Promise<NaveTopic | undefined>
}

export const localNaveAccess: NaveAccess = {
  getAvailability: async language => {
    const availability = await getLocalResourceAvailability({
      kind: 'database',
      databaseId: 'NAVE',
      language,
    })
    return availability.status === 'available'
      ? { status: 'available' }
      : availability.status === 'corrupt'
        ? {
            status: 'unavailable',
            reason: 'invalid-offline-copy',
            recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
          }
        : {
            status: 'unavailable',
            reason: 'offline-copy-required',
            recoveries: ['acquire-offline-copy'],
          }
  },
  listByLetter: async letter =>
    unwrapLocalResourceResult(await loadNaveByLetter(letter)).map(mapLocalNaveTopic),
  search: async searchValue =>
    unwrapLocalResourceResult(await loadNaveBySearch(searchValue)).map(mapLocalNaveTopic),
  loadItem: async nameLower => {
    const item = unwrapLocalResourceResult(await loadNaveItem(nameLower))
    return item ? { ...mapLocalNaveTopic(item), description: item.description } : undefined
  },
  loadByVerse: async verse => {
    try {
      const [verseTopics, chapterTopics] = await loadNaveByVerset(verse)
      const mapTopics = (topics: { name: string; name_lower: string }[] | undefined) =>
        topics?.map(topic => ({ name: topic.name, normalizedName: topic.name_lower }))
      return [mapTopics(verseTopics), mapTopics(chapterTopics)]
    } catch (error) {
      throw mapLocalResourceError(error)
    }
  },
  loadRandom: async () => {
    const item = unwrapLocalResourceResult(await loadNaveByRandom())
    return item ? { ...mapLocalNaveTopic(item), description: item.description } : undefined
  },
}

const mapLocalNaveTopic = (item: { name_lower: string; name: string; letter: string }) => ({
  normalizedName: item.name_lower,
  name: item.name,
  initial: item.letter,
})
