import { useAtom } from 'jotai/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionList } from 'react-native'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { getVersionsBySections } from '~helpers/bibleVersions'
import { getDatabases } from '~helpers/databases'
import useLanguage from '~helpers/useLanguage'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { selectedResourcesAtom } from './atom'
import {
  getDefaultOnboardingResourceSelection,
  getOnboardingResourceSelectionId,
  type OnboardingResourceSelection,
} from './onboardingResources'
import ResourceItem from './ResourceItem'

const DownloadFiles = ({ setStep }: { setStep: React.Dispatch<React.SetStateAction<number>> }) => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const databases = Object.values(getDatabases()).filter(db =>
    lang !== 'fr' ? db.id !== 'MHY' : true
  )
  const [selectedResources, setSelectedResources] = useAtom(selectedResourcesAtom)

  // Set default version
  useEffect(() => {
    setSelectedResources([getDefaultOnboardingResourceSelection(lang)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPressItem = (resource: OnboardingResourceSelection) => {
    const resourceId = getOnboardingResourceSelectionId(resource)
    setSelectedResources(res => {
      if (res.find(r => getOnboardingResourceSelectionId(r) === resourceId)) {
        return res.filter(r => getOnboardingResourceSelectionId(r) !== resourceId)
      }
      return [...res, resource]
    })
  }

  const isSelected = (resource: OnboardingResourceSelection) => {
    const resourceId = getOnboardingResourceSelectionId(resource)
    return selectedResources.some(r => getOnboardingResourceSelectionId(r) === resourceId)
  }

  return (
    <Container>
      <SectionList
        ListHeaderComponent={
          <>
            <Box paddingTop={100} paddingBottom={30}>
              <Box>
                <Text padding={20} title fontSize={40}>
                  {t('Vous êtes presque prêt !')}
                </Text>
              </Box>
              <Box>
                <Paragraph fontFamily="text" px={20} mt={40}>
                  {t(
                    'Choisissez les bases de données et les bibles que vous souhaitez télécharger.'
                  )}
                </Paragraph>
              </Box>
            </Box>
            <Text padding={20} title fontSize={25}>
              {t('Bases de données')}
            </Text>
            {Object.values(databases).map(db => (
              <ResourceItem
                key={db.id}
                name={db.name}
                subTitle={db.desc}
                fileSize={db.fileSize}
                isSelected={isSelected({
                  kind: 'database',
                  databaseId: db.id,
                  lang,
                })}
                onPress={() =>
                  onPressItem({
                    kind: 'database',
                    databaseId: db.id,
                    lang,
                  })
                }
              />
            ))}

            <Text padding={20} paddingBottom={0} title fontSize={25}>
              {t('Bibles')}
            </Text>
          </>
        }
        stickySectionHeadersEnabled={false}
        sections={getVersionsBySections()}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <Box paddingHorizontal={20} marginTop={20}>
            <Text fontSize={16} color="tertiary">
              {title}
            </Text>
            <Border marginTop={10} />
          </Box>
        )}
        renderItem={({ item: version }) =>
          version.id === 'LSGS' || version.id === 'KJVS' ? null : (
            <ResourceItem
              name={version.name}
              isSelected={isSelected({ kind: 'bible', versionId: version.id })}
              isDisabled={version.id === getDefaultBibleVersion(lang)}
              onPress={() => {
                onPressItem({
                  kind: 'bible',
                  versionId: version.id,
                })
              }}
            />
          )
        }
      />
      <Box padding={20}>
        <Button onPress={() => setStep(2)}>{t('Continuer')}</Button>
      </Box>
    </Container>
  )
}

export default DownloadFiles
