import type { BibleTab, VersionCode } from '~state/tabs'

export const selectBibleTabVersion = (
  data: BibleTab['data'],
  selectedVersion: VersionCode
): BibleTab['data'] => ({
  ...data,
  selectedVersion,
  ...(data.entityReference && {
    entityReference: {
      ...data.entityReference,
      preferredVersion: selectedVersion,
    },
  }),
})
