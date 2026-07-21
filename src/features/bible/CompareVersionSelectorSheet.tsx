import { Sheet, type SheetRef } from '~common/sheet'
import React from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import VersionSelectorItem from '~features/bible/VersionSelectorItem'
import { versions } from '~helpers/bibleVersions'
import { toggleCompareVersion } from '~redux/modules/user'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import type { VersionCode } from 'src/state/tabs'
import { useVersionCatalog, VersionCatalogHeader, VersionCatalogList } from './VersionCatalogView'

type CompareVersionSelectorSheetProps = {
  sheetRef: React.RefObject<SheetRef | null>
}

const CompareVersionSelectorSheet = ({ sheetRef }: CompareVersionSelectorSheetProps) => {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const versionCatalog = useVersionCatalog(Object.values(versions))
  const [scrollToTopKey, setScrollToTopKey] = React.useState(0)
  const versionsToCompare = useSelector(
    (state: RootState) => Object.keys(state.user.bible.settings.compare),
    shallowEqual
  )

  const toggleVersion = (versionId: VersionCode) => {
    dispatch(toggleCompareVersion(versionId))
  }

  const addCompletedDownload = (versionId: VersionCode) => {
    if (!versionsToCompare.includes(versionId)) {
      dispatch(toggleCompareVersion(versionId))
    }
  }

  return (
    <>
      <Sheet
        ref={sheetRef}
        snapPoints={[1]}
        scrollableOptions={{ scrollingExpandsSheet: false }}
        onPresent={() => {
          versionCatalog.resetSearch()
          setScrollToTopKey(current => current + 1)
        }}
        header={
          <VersionCatalogHeader
            title={t('Sélectionner les versions')}
            {...versionCatalog.headerProps}
          />
        }
      >
        <VersionCatalogList
          sections={versionCatalog.sections}
          grouping={versionCatalog.grouping}
          query={versionCatalog.query}
          openStyleInfo={versionCatalog.openStyleInfo}
          bottomInset={insets.bottom}
          scrollToTopKey={`${scrollToTopKey}:${versionCatalog.filterKey}`}
          renderItem={({ item }) => (
            <VersionSelectorItem
              version={item}
              isSelected={versionsToCompare.includes(item.id)}
              onChange={toggleVersion}
              onDownloadComplete={addCompletedDownload}
              showSelectionCheckbox
            />
          )}
        />
      </Sheet>
      {versionCatalog.modals}
    </>
  )
}

export default CompareVersionSelectorSheet
