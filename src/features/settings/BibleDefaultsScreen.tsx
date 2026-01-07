import React from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { SectionList } from 'react-native'

import Header from '~common/Header'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { versions, Version } from '~helpers/bibleVersions'
import { setDefaultBibleVersion } from '~redux/modules/user'
import { RootState } from '~redux/modules/reducer'
import { getLangIsFr } from '~i18n'
import VersionSelectorItem from '~features/bible/VersionSelectorItem'
import { VersionCode } from 'src/state/tabs'

const BibleDefaultsScreen = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const defaultVersion = useSelector(
    (state: RootState) =>
      state.user.bible.settings.defaultBibleVersion || (getLangIsFr() ? 'LSG' : 'KJV')
  )

  const handleVersionChange = (versionId: VersionCode) => {
    dispatch(setDefaultBibleVersion(versionId))
  }

  // Group versions by language for SectionList
  const sections = [
    {
      title: t('Français'),
      data: Object.values(versions).filter(v => v.type === 'fr') as Version[],
    },
    {
      title: t('English'),
      data: Object.values(versions).filter(v => v.type === 'en') as Version[],
    },
  ]

  return (
    <Container>
      <Header hasBackButton title={t('bibleDefaults.title')} />
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <Box paddingHorizontal={20} paddingVertical={15}>
            <Text fontSize={14} color="grey">
              {t('bibleDefaults.defaultVersionDescription')}
            </Text>
          </Box>
        }
        renderSectionHeader={({ section: { title } }) => (
          <Box paddingHorizontal={20} paddingVertical={10} bg="lightGrey">
            <Text bold fontSize={13} color="grey" style={{ textTransform: 'uppercase' }}>
              {title}
            </Text>
          </Box>
        )}
        renderItem={({ item: version }) => (
          <VersionSelectorItem
            version={version}
            isSelected={defaultVersion === version.id}
            onChange={handleVersionChange}
            onDownloadComplete={handleVersionChange}
          />
        )}
        stickySectionHeadersEnabled={false}
      />
    </Container>
  )
}

export default BibleDefaultsScreen
