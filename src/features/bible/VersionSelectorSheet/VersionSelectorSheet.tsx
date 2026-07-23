import { Sheet, type SheetRef } from '~common/sheet'
import { useAtomValue, useSetAtom } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { versions } from '~helpers/bibleVersions'
import { VersionCode } from '~state/tabs'
import VersionSelectorItem from '../VersionSelectorItem'
import { bookSelectorDataAtom } from '../BookSelectorSheet/BookSelectorSheet'
import { useTheme } from '@emotion/react'
import { useVersionCatalog, VersionCatalogHeader, VersionCatalogList } from '../VersionCatalogView'
import { versionSelectorDataAtom } from './state'

interface VersionSelectorSheetProps {
  sheetRef: React.RefObject<SheetRef | null>
}

const VersionSelectorSheet = ({ sheetRef }: VersionSelectorSheetProps) => {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const theme = useTheme()
  const versionCatalog = useVersionCatalog(
    Object.values(versions).filter(version => !version.hidden)
  )
  const [revealKey, setRevealKey] = React.useState(0)

  const { actions, data, parallelVersionIndex } = useAtomValue(versionSelectorDataAtom)
  const setBookSelectorData = useSetAtom(bookSelectorDataAtom)

  const handleVersionSelect = (vers: VersionCode) => {
    if (!actions) return

    if (parallelVersionIndex === undefined) {
      actions.setSelectedVersion(vers)
      setBookSelectorData(current => ({
        ...current,
        data: current.data
          ? {
              ...current.data,
              selectedVersion: vers,
            }
          : current.data,
      }))
    } else {
      actions.setParallelVersion(vers, parallelVersionIndex)
    }
    sheetRef.current?.dismiss()
  }

  const selectedVersion =
    parallelVersionIndex === undefined
      ? data?.selectedVersion
      : data?.parallelVersions[parallelVersionIndex]

  return (
    <>
      <Sheet
        ref={sheetRef}
        snapPoints={[1]}
        backgroundColor={theme.colors.reverse}
        onPresent={() => {
          versionCatalog.resetSearch()
          setRevealKey(current => current + 1)
        }}
        header={<VersionCatalogHeader title={t('Version')} {...versionCatalog.headerProps} />}
      >
        <VersionCatalogList
          sections={versionCatalog.sections}
          grouping={versionCatalog.grouping}
          query={versionCatalog.query}
          openStyleInfo={versionCatalog.openStyleInfo}
          bottomInset={insets.bottom}
          revealVersionId={selectedVersion}
          revealKey={revealKey}
          scrollToTopKey={versionCatalog.filterKey}
          renderItem={({ item }) => (
            <VersionSelectorItem
              onChange={handleVersionSelect}
              version={item}
              isSelected={item.id === selectedVersion}
            />
          )}
        />
      </Sheet>
      {versionCatalog.modals}
    </>
  )
}

export default VersionSelectorSheet
