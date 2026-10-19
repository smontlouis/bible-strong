// Parallel reading selects verses in one version: the tab records which one.
type BibleSelectionData<Version extends string> = {
  selectedVersion: Version
  selectedVersesVersion?: Version
  parallelVersions: Version[]
}

/** The version the selected verses belong to: a version on screen, by default the main one. */
export const getSelectedVersesVersion = <Version extends string>(
  data: BibleSelectionData<Version>
): Version =>
  data.selectedVersesVersion && data.parallelVersions.includes(data.selectedVersesVersion)
    ? data.selectedVersesVersion
    : data.selectedVersion

/** Records the version of a selection; the main version is the default and is left implicit. */
export const setSelectedVersesVersion = <Version extends string>(
  data: BibleSelectionData<Version>,
  version: Version
) => {
  if (version === data.selectedVersion) delete data.selectedVersesVersion
  else data.selectedVersesVersion = version
}
