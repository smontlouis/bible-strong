import type { VersionCode } from '~state/tabs'
import type { ReaderSnapshot } from './world'

/** A version named by the reader, kept only when a column shows it: the main one otherwise. */
export const getVersionOnScreen = (
  { parallelColumnVersions }: Pick<ReaderSnapshot, 'parallelColumnVersions'>,
  mainVersion: VersionCode,
  version: string | undefined
): VersionCode => parallelColumnVersions.find(parallel => parallel === version) ?? mainVersion
