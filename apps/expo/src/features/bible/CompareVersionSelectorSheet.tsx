import { Sheet, type SheetRef } from '~common/sheet'
import React from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@emotion/react'

import VersionSelectorItem from '~features/bible/VersionSelectorItem'
import { versions } from '~helpers/bibleVersions'
import { toggleCompareVersion } from '~redux/modules/user'
import { selectCompareVersions } from '~redux/selectors/user'
import type { AppDispatch } from '~redux/store'
import type { VersionCode } from 'src/state/tabs'
import { useVersionCatalog, VersionCatalogHeader, VersionCatalogList } from './VersionCatalogView'
import BibleOfflineDetailsSheet from './VersionSelectorSheet/BibleOfflineDetailsSheet'
import { useBibleOfflineDetails } from './VersionSelectorSheet/useBibleOfflineDetails'

type CompareVersionSelectorSheetProps = {
  sheetRef: React.RefObject<SheetRef | null>
}

const CompareVersionSelectorSheet = ({ sheetRef }: CompareVersionSelectorSheetProps) => {
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const versionCatalog = useVersionCatalog(
    Object.values(versions).filter(version => !version.hidden)
  )
  const [scrollToTopKey, setScrollToTopKey] = React.useState(0)
  const versionsToCompare = useSelector(selectCompareVersions, shallowEqual)
  const offlineDetails = useBibleOfflineDetails()

  const toggleVersion = (versionId: VersionCode) => {
    dispatch(toggleCompareVersion(versionId))
  }

  return (
    <>
      <Sheet
        ref={sheetRef}
        snapPoints={[1]}
        backgroundColor={theme.colors.reverse}
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
              showSelectionCheckbox
              showStrongIndex
              onOpenOfflineDetails={version => {
                void offlineDetails.open(version)
              }}
            />
          )}
        />
      </Sheet>
      {versionCatalog.modals}
      <BibleOfflineDetailsSheet
        sheetRef={offlineDetails.sheetRef}
        version={offlineDetails.version}
      />
    </>
  )
}

export default CompareVersionSelectorSheet
