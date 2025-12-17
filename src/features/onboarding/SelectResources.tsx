import { useAtom } from 'jotai/react'
import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionList } from 'react-native'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { getVersions, getVersionsBySections } from '~helpers/bibleVersions'
import { getDatabases } from '~helpers/databases'
import { biblesRef, getDatabaseUrl, getDatabasesRef } from '~helpers/firebase'
import { requireBiblePath } from '~helpers/requireBiblePath'
import useLanguage from '~helpers/useLanguage'
import { ResourceToDownload, selectedResourcesAtom } from './atom'
import ResourceItem from './ResourceItem'

const DownloadFiles = ({ setStep }: { setStep: React.Dispatch<React.SetStateAction<number>> }) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  const databases = Object.values(getDatabases()).filter(db => (!isFR ? db.id !== 'MHY' : true))
  const [selectedResources, setSelectedResources] = useAtom(selectedResourcesAtom)

  const getDefaultVersion = (): ResourceToDownload => {
    const defaultVersion = isFR ? getVersions().LSG : getVersions().KJV
    const path = requireBiblePath(defaultVersion.id)
    const uri =
      defaultVersion.id === 'INT'
        ? getDatabaseUrl('INTERLINEAIRE', 'fr')
        : defaultVersion.id === 'INT_EN'
          ? getDatabaseUrl('INTERLINEAIRE', 'en')
          : biblesRef[defaultVersion.id]

    return {
      id: defaultVersion.id,
      name: defaultVersion.name,
      path,
      uri,
      fileSize: 2500000,
    }
  }

  // Set default version
  useEffect(() => {
    setSelectedResources([getDefaultVersion()])
  }, [])

  const onPressItem = (resource: ResourceToDownload) => {
    setSelectedResources(res => {
      if (res.find(r => r.id === resource.id)) {
        return res.filter(r => r.id !== resource.id)
      }
      return [...res, resource]
    })
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
                isSelected={Boolean(selectedResources.find(r => r.id === db.id))}
                onPress={() =>
                  onPressItem({
                    id: db.id,
                    name: db.name,
                    path: db.path,
                    uri: getDatabasesRef()[db.id],
                    fileSize: db.fileSize,
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
              isSelected={Boolean(selectedResources.find(r => r.id === version.id))}
              isDisabled={version.id === (isFR ? 'LSG' : 'KJV')}
              onPress={() => {
                const path = requireBiblePath(version.id)
                const uri =
                  version.id === 'INT'
                    ? getDatabaseUrl('INTERLINEAIRE', 'fr')
                    : version.id === 'INT_EN'
                      ? getDatabaseUrl('INTERLINEAIRE', 'en')
                      : biblesRef[version.id]

                onPressItem({
                  id: version.id,
                  name: version.name,
                  path,
                  uri,
                  fileSize: 2500000,
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
