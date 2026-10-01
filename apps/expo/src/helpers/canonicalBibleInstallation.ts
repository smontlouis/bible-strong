import { getBibleVersionMetadata } from './biblesDb'

// From schema 4, the canonical Bible embeds headings and layout events (including red words).
// Later schemas stay additive (ADR-0034).
const SELF_CONTAINED_CANONICAL_BIBLE_SCHEMA_VERSION = 4

export const isCanonicalBibleSchemaVersion = (schemaVersion: number | null | undefined): boolean =>
  typeof schemaVersion === 'number' &&
  schemaVersion >= SELF_CONTAINED_CANONICAL_BIBLE_SCHEMA_VERSION

export const isInstalledBibleCanonical = async (versionId: string): Promise<boolean> =>
  isCanonicalBibleSchemaVersion((await getBibleVersionMetadata(versionId))?.schemaVersion)
