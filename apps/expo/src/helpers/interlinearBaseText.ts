import {
  getBibleVersionMetadata,
  setBibleVersionTextIdentity,
  type BibleVersionMetadata,
} from './biblesDb'
import { isCanonicalBibleSchemaVersion } from './canonicalBibleInstallation'
import {
  getPublishedInterlinearTextIdentity,
  type InterlinearTextIdentity,
} from './interlinearBiblePublications'

/** Text identity of the installed BHG; empty for a copy installed without one. */
export type InstalledInterlinearBaseText = Partial<InterlinearTextIdentity>

type InstalledBaseTextRecord = Pick<
  BibleVersionMetadata,
  'textRevision' | 'textSha256' | 'schemaVersion' | 'resourceGeneration'
>

/**
 * Applications up to 27.1.1 recorded, for a BHG copy that carries no revision of its own, the
 * revision compiled into them — whatever archive they had just installed. The catalog entry of
 * the installed archive, when the application holds it, says which text that archive really is.
 * A copy installed from a file that declares its revision is never corrected.
 */
export const resolveInstalledInterlinearBaseText = (
  record: InstalledBaseTextRecord,
  declared: InterlinearTextIdentity | undefined
): { text: InstalledInterlinearBaseText; correction?: InterlinearTextIdentity } => {
  const recorded: InstalledInterlinearBaseText = {
    ...(record.textRevision ? { textRevision: record.textRevision } : {}),
    ...(record.textSha256 ? { textSha256: record.textSha256 } : {}),
  }
  if (
    !declared ||
    isCanonicalBibleSchemaVersion(record.schemaVersion) ||
    (declared.textRevision === record.textRevision && declared.textSha256 === record.textSha256)
  ) {
    return { text: recorded }
  }
  return { text: declared, correction: declared }
}

export const getInstalledInterlinearBaseText = async (): Promise<
  InstalledInterlinearBaseText | undefined
> => {
  const record = await getBibleVersionMetadata('BHG')
  if (!record) return undefined
  const { text, correction } = resolveInstalledInterlinearBaseText(
    record,
    getPublishedInterlinearTextIdentity(record.resourceGeneration)
  )
  if (correction) await setBibleVersionTextIdentity('BHG', correction)
  return text
}
