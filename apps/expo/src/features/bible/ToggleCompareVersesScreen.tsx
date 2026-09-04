import React from 'react'
import { useSelector, useDispatch, shallowEqual } from 'react-redux'
import Container from '~common/ui/Container'
import { toggleCompareVersion } from '~redux/modules/user'
import { versions } from '~helpers/bibleVersions'
import { useTranslation } from 'react-i18next'
import type { AppDispatch } from '~redux/store'
import { selectCompareVersions } from '~redux/selectors/user'
import { useVersionCatalog, VersionCatalogHeader, VersionCatalogList } from './VersionCatalogView'
import VersionSelectorItem from './VersionSelectorItem'
import BibleOfflineDetailsSheet from './VersionSelectorSheet/BibleOfflineDetailsSheet'
import { useBibleOfflineDetails } from './VersionSelectorSheet/useBibleOfflineDetails'

const ToggleCompareVersesScreen = () => {
  const versionsToCompare = useSelector(selectCompareVersions, shallowEqual)
  const dispatch = useDispatch<AppDispatch>()
  const { t } = useTranslation()
  const offlineDetails = useBibleOfflineDetails()
  const versionCatalog = useVersionCatalog(
    Object.values(versions).filter(version => !version.hidden),
    { resetSearchOnFocus: true }
  )

  return (
    <Container>
      <VersionCatalogHeader
        title={t('Sélectionner les versions')}
        hasBackButton
        {...versionCatalog.headerProps}
      />
      <VersionCatalogList
        sections={versionCatalog.sections}
        grouping={versionCatalog.grouping}
        query={versionCatalog.query}
        openStyleInfo={versionCatalog.openStyleInfo}
        scrollToTopKey={`${versionCatalog.focusKey}:${versionCatalog.filterKey}`}
        renderItem={({ item }) => (
          <VersionSelectorItem
            version={item}
            isSelected={versionsToCompare.includes(item.id)}
            onChange={versionId => dispatch(toggleCompareVersion(versionId))}
            showSelectionCheckbox
            showStrongIndex
            onOpenOfflineDetails={version => {
              void offlineDetails.open(version)
            }}
          />
        )}
      />
      {versionCatalog.modals}
      <BibleOfflineDetailsSheet
        sheetRef={offlineDetails.sheetRef}
        version={offlineDetails.version}
      />
    </Container>
  )
}

export default ToggleCompareVersesScreen
