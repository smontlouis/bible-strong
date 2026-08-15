import React from 'react'
import { useAtomValue } from 'jotai/react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Sheet, type SheetRef } from '~common/sheet'
import VersionSelectorItem from '~features/bible/VersionSelectorItem'
import {
  useVersionCatalog,
  VersionCatalogHeader,
  VersionCatalogList,
} from '~features/bible/VersionCatalogView'
import {
  getBibleDefaultCatalog,
  type BibleDefaultSelectionKind,
} from '~features/bible/bibleDefaultCatalog'
import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import { getStrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import type { VersionCode } from '~state/tabs'

type Props = {
  kind: BibleDefaultSelectionKind
  selectedVersionId: string
  sheetRef: React.RefObject<SheetRef | null>
  title: string
  onSelect: (versionId: VersionCode) => void
}

const BibleDefaultSelectorSheet = ({
  kind,
  selectedVersionId,
  sheetRef,
  title,
  onSelect,
}: Props) => {
  const insets = useSafeAreaInsets()
  const versionCatalog = useVersionCatalog(getBibleDefaultCatalog(kind))
  const [revealKey, setRevealKey] = React.useState(0)
  const [pendingStrongVersionId, setPendingStrongVersionId] = React.useState<VersionCode>()
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)

  const selectVersion = (versionId: VersionCode) => {
    if (kind === 'strong' && !isStrongCapableBibleVersion(versionId)) return

    onSelect(versionId)
    sheetRef.current?.dismiss()
  }

  React.useEffect(() => {
    if (kind !== 'strong' || !pendingStrongVersionId) return

    let cancelled = false
    getStrongBibleSidecarAvailability(pendingStrongVersionId)
      .then(availability => {
        if (cancelled || availability.status !== 'available') return

        setPendingStrongVersionId(undefined)
        onSelect(pendingStrongVersionId)
        sheetRef.current?.dismiss()
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [downloadCompletionSignal, kind, onSelect, pendingStrongVersionId, sheetRef])

  const headerProps =
    kind === 'strong'
      ? {
          ...versionCatalog.headerProps,
          filters: versionCatalog.headerProps.filters.filter(
            filter => filter.key !== 'availability'
          ),
        }
      : versionCatalog.headerProps

  return (
    <>
      <Sheet
        ref={sheetRef}
        snapPoints={[1]}
        onPresent={() => {
          versionCatalog.resetSearch()
          setRevealKey(current => current + 1)
        }}
        header={<VersionCatalogHeader title={title} {...headerProps} />}
      >
        <VersionCatalogList
          sections={versionCatalog.sections}
          grouping={versionCatalog.grouping}
          query={versionCatalog.query}
          openStyleInfo={versionCatalog.openStyleInfo}
          bottomInset={insets.bottom}
          revealVersionId={selectedVersionId}
          revealKey={revealKey}
          scrollToTopKey={versionCatalog.filterKey}
          renderItem={({ item }) => (
            <VersionSelectorItem
              version={item}
              isSelected={item.id === selectedVersionId}
              selectionRequirement={kind === 'strong' ? 'strong' : 'bible'}
              onChange={selectVersion}
              onDownloadStart={
                kind === 'strong' ? versionId => setPendingStrongVersionId(versionId) : undefined
              }
              onDownloadComplete={kind === 'reading' ? selectVersion : undefined}
            />
          )}
        />
      </Sheet>
      {versionCatalog.modals}
    </>
  )
}

export default BibleDefaultSelectorSheet
