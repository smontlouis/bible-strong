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
import useLanguage from '~helpers/useLanguage'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import {
  getStrongBiblePublication,
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import { selectedResourcesAtom } from './atom'
import {
  getDefaultOnboardingResourceSelection,
  getOnboardingDatabaseResourceOptions,
  getOnboardingResourceSelectionId,
  toggleOnboardingResourceSelection,
  type OnboardingResourceSelection,
} from './onboardingResources'
import ResourceItem from './ResourceItem'
import { getStrongLexiconPublication } from '~helpers/strongLexiconPublications'

const DownloadFiles = ({ setStep }: { setStep: React.Dispatch<React.SetStateAction<number>> }) => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const databases = getOnboardingDatabaseResourceOptions(lang)
  const [selectedResources, setSelectedResources] = useAtom(selectedResourcesAtom)

  // Set default version
  useEffect(() => {
    setSelectedResources([getDefaultOnboardingResourceSelection(lang)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPressItem = (resource: OnboardingResourceSelection) => {
    setSelectedResources(res => toggleOnboardingResourceSelection(res, resource))
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
            <ResourceItem
              name={t('Lexique Strong')}
              subTitle={t('Définitions françaises et anglaises, morphologie et mots liés')}
              fileSize={getStrongLexiconPublication('core').archiveBytes}
              isSelected={isSelected({ kind: 'strong-lexicon' })}
              onPress={() => onPressItem({ kind: 'strong-lexicon' })}
            />
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
            <>
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
              {isStrongCapableBibleVersion(version.id) && (
                <Box pl={20}>
                  <ResourceItem
                    name={t('Mode Strong')}
                    subTitle={t(
                      'Ajoute les numéros Strong à cette Bible. Le texte biblique reste utilisable sans ce téléchargement.'
                    )}
                    fileSize={
                      getStrongBiblePublication(version.id as StrongBibleVersionId).strong
                        .archiveBytes
                    }
                    isSelected={isSelected({
                      kind: 'bible-strong',
                      versionId: version.id as StrongBibleVersionId,
                    })}
                    onPress={() =>
                      onPressItem({
                        kind: 'bible-strong',
                        versionId: version.id as StrongBibleVersionId,
                      })
                    }
                  />
                </Box>
              )}
            </>
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
