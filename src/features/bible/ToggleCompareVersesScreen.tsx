import React from 'react'
import styled from '@emotion/native'
import { Switch } from 'react-native-paper'
import { useSelector, useDispatch } from 'react-redux'
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

const TextVersion = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 12,
  opacity: 0.5,
  fontWeight: 'bold',
}))

const TextName = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 16,
  backgroundColor: 'transparent',
}))

const SwitchVersion = withTheme(({ version, isSelected, onChange, theme }) => {
  if (isStrongVersion(version.id)) {
    return null
  }

  return (
    <Box paddingHorizontal={20} paddingVertical={10} row>
      <Box flex>
        <TextVersion>{version.id}</TextVersion>
        <TextName>{version.name}</TextName>
      </Box>
      <Switch
        color={theme.colors.primary}
        value={isSelected}
        onValueChange={onChange}
      />
    </Box>
  )
})

const ToggleCompareVersesScreen = () => {
  const versionsToCompare = useSelector(state =>
    Object.keys(state.user.bible.settings.compare)
  )
  const dispatch = useDispatch()
  const { t } = useTranslation()

  return (
    <Container>
      <Header hasBackButton title={t('Sélectionner les versions')} />
      <SectionList
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
            onChange={() => dispatch(toggleCompareVersion(item.id))}
          />
        )}
      />
    </Container>
  )
}

export default ToggleCompareVersesScreen
