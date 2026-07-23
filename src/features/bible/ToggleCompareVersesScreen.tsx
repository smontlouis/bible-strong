import React from 'react'
import styled from '@emotion/native'
import { useSelector, useDispatch, shallowEqual } from 'react-redux'
import { withTheme } from '@emotion/react'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { toggleCompareVersion } from '~redux/modules/user'
import { isStrongVersion, versions } from '~helpers/bibleVersions'
import { useTranslation } from 'react-i18next'
import Switch from '~common/ui/Switch'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import type { Theme } from '~themes'
import { useVersionCatalog, VersionCatalogHeader, VersionCatalogList } from './VersionCatalogView'
import type { VersionCatalogItem } from './versionCatalog'

const TextVersion = styled.Text<{ isSelected?: boolean; theme?: Theme }>(
  ({ isSelected, theme }) => ({
    color: isSelected ? theme.colors.primary : theme.colors.default,
    fontSize: 12,
    opacity: 0.5,
    fontWeight: 'bold',
  })
)

const TextName = styled.Text<{ isSelected?: boolean; theme?: Theme }>(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 16,
  backgroundColor: 'transparent',
}))

type SwitchVersionProps = {
  version: VersionCatalogItem
  isSelected: boolean
  onChange: () => void
}

const SwitchVersion = withTheme(({ version, isSelected, onChange }: SwitchVersionProps) => {
  if (isStrongVersion(version.id)) {
    return null
  }

  return (
    <Box
      minHeight={76}
      paddingHorizontal={20}
      paddingVertical={12}
      borderBottomWidth={1}
      borderColor="border"
      row
      alignItems="center"
    >
      <Box flex>
        <TextVersion isSelected={isSelected}>{version.id}</TextVersion>
        <TextName isSelected={isSelected}>{version.displayName}</TextName>
      </Box>
      <Switch value={isSelected} onValueChange={onChange} />
    </Box>
  )
})

const ToggleCompareVersesScreen = () => {
  const versionsToCompare = useSelector(
    (state: RootState) => Object.keys(state.user.bible.settings.compare),
    shallowEqual
  )
  const dispatch = useDispatch<AppDispatch>()
  const { t } = useTranslation()
  const versionCatalog = useVersionCatalog(
    Object.values(versions).filter(version => !version.hidden && !isStrongVersion(version.id)),
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
          <SwitchVersion
            version={item}
            isSelected={versionsToCompare.includes(item.id)}
            onChange={() => {
              dispatch(toggleCompareVersion(item.id))
            }}
          />
        )}
      />
      {versionCatalog.modals}
    </Container>
  )
}

export default ToggleCompareVersesScreen
