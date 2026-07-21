import { getIfVersionNeedsDownload, versions } from '~helpers/bibleVersions'

let cachedAvailability:
  | {
      signal: number
      promise: Promise<ReadonlySet<string>>
    }
  | undefined

const loadDownloadedBibleVersionIds = async () => {
  const downloadedIds = await Promise.all(
    Object.values(versions).map(async version => {
      try {
        return (await getIfVersionNeedsDownload(version.id)) ? null : version.id
      } catch {
        return null
      }
    })
  )

  return new Set(downloadedIds.filter((id): id is string => Boolean(id)))
}

export const getDownloadedBibleVersionIds = (installedVersionsSignal: number) => {
  if (cachedAvailability?.signal === installedVersionsSignal) {
    return cachedAvailability.promise
  }

  const promise = loadDownloadedBibleVersionIds()
  cachedAvailability = { signal: installedVersionsSignal, promise }
  return promise
}
