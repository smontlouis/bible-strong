import React from 'react'
import styled from '@emotion/native'
import { useSelector, useDispatch, shallowEqual } from 'react-redux'
import { withTheme } from '@emotion/react'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Container from '~common/ui/Container'
import SectionList from '~common/ui/SectionList'
import Border from '~common/ui/Border'
import Header from '~common/Header'
import { toggleCompareVersion } from '~redux/modules/user'
import { getVersionsBySections, isStrongVersion } from '~helpers/bibleVersions'
import { useTranslation } from 'react-i18next'
import Switch from '~common/ui/Switch'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import type { Version } from '~helpers/bibleVersions'
import type { Theme } from '~themes'

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
  version: Version
  isSelected: boolean
  onChange: () => void
}

const SwitchVersion = withTheme(({ version, isSelected, onChange }: SwitchVersionProps) => {
  if (isStrongVersion(version.id)) {
    return null
  }

  return (
    <Box paddingHorizontal={20} paddingVertical={10} row>
      <Box flex>
        <TextVersion isSelected={isSelected}>{version.id}</TextVersion>
        <TextName isSelected={isSelected}>{version.name}</TextName>
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

  return (
    <Container>
      <Header hasBackButton title={t('Sélectionner les versions')} />
      <SectionList<Version, { title: string; data: Version[] }>
        contentContainerStyle={{ paddingTop: 0 }}
        stickySectionHeadersEnabled={false}
        sections={getVersionsBySections()}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <Box paddingHorizontal={20} marginTop={30}>
            <Text fontSize={16} color="tertiary">
              {title}
            </Text>
            <Border marginTop={10} />
          </Box>
        )}
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
    </Container>
  )
}

export default ToggleCompareVersesScreen
