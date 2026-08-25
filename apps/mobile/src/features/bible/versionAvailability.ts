import { versions } from '~helpers/bibleVersions'

let cachedAvailability:
  | {
      signal: number
      promise: Promise<ReadonlySet<string>>
    }
  | undefined

const loadDownloadedBibleVersionIds = async (
  isAvailable: (versionId: string) => Promise<boolean>
) => {
  const downloadedIds = await Promise.all(
    Object.values(versions).map(async version => {
      try {
        return (await isAvailable(version.id)) ? version.id : null
      } catch {
        return null
      }
    })
  )

  return new Set(downloadedIds.filter((id): id is string => Boolean(id)))
}

export const getDownloadedBibleVersionIds = (
  installedVersionsSignal: number,
  isAvailable: (versionId: string) => Promise<boolean>
) => {
  if (cachedAvailability?.signal === installedVersionsSignal) {
    return cachedAvailability.promise
  }

  const promise = loadDownloadedBibleVersionIds(isAvailable)
  cachedAvailability = { signal: installedVersionsSignal, promise }
  return promise
}
