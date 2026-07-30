import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import type { StrongDetailRouteContext } from './strongDetailRoutes'

export const resolveStrongBibleVersionId = (
  context: StrongDetailRouteContext,
  defaultVersionId: StrongBibleVersionId
): StrongBibleVersionId =>
  context.bibleVersion && isStrongCapableBibleVersion(context.bibleVersion)
    ? context.bibleVersion
    : context.strongBibleVersionId && isStrongCapableBibleVersion(context.strongBibleVersionId)
      ? context.strongBibleVersionId
      : defaultVersionId
