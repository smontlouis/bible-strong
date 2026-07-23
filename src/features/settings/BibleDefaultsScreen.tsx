import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'

import Container from '~common/ui/Container'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { versions } from '~helpers/bibleVersions'
import { setDefaultBibleVersion, setDefaultStrongBibleVersion } from '~redux/modules/user'
import { RootState } from '~redux/modules/reducer'
import { getLanguage } from '~i18n'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import VersionSelectorItem from '~features/bible/VersionSelectorItem'
import { VersionCode } from 'src/state/tabs'
import {
  useVersionCatalog,
  VersionCatalogHeader,
  VersionCatalogList,
} from '~features/bible/VersionCatalogView'
import { getVersionDisplayName } from '~features/bible/versionCatalog'
import {
  STRONG_BIBLE_PUBLICATIONS,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import { getStrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import { useAtomValue } from 'jotai/react'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'

type SelectedVersionCardProps = {
  code: string
  name: string
}

const SelectedVersionCard = ({ code, name }: SelectedVersionCardProps) => {
  const { t } = useTranslation()

  return (
    <Box mt={16} p={16} bg="primary" borderRadius={12} row alignItems="center">
      <Box flex>
        <Text color="reverse" fontSize={12} bold opacity={0.8}>
          {t('bibleDefaults.selectedVersion')}
        </Text>
        <Text mt={5} color="reverse" fontSize={12} bold opacity={0.8}>
          {code}
        </Text>
        <Text mt={2} color="reverse" fontSize={18} bold>
          {name}
        </Text>
      </Box>
      <Box ml={12} width={36} height={36} borderRadius={18} bg="reverse" center>
        <FeatherIcon name="check" size={20} color="primary" />
      </Box>
    </Box>
  )
}

const BibleDefaultsScreen = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const versionCatalog = useVersionCatalog(
    Object.values(versions).filter(
      version => !version.hidden && (version.language === 'fr' || version.language === 'en')
    ),
    { resetSearchOnFocus: true }
  )

  const language = getLanguage()
  const preferredVersion = useSelector(
    (state: RootState) =>
      state.user.bible.settings.defaultBibleVersion || getDefaultBibleVersion(language)
  )
  const defaultVersion = versions[preferredVersion]
    ? preferredVersion
    : getDefaultBibleVersion(language)
  const selectedVersion = versions[defaultVersion]
  const selectedVersionName = getVersionDisplayName(selectedVersion, language)
  const defaultStrongVersion = useSelector(
    (state: RootState) => state.user.bible.settings.defaultStrongBibleVersionId ?? 'LSG'
  )
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const [availableStrongVersions, setAvailableStrongVersions] = useState<Set<StrongBibleVersionId>>(
    new Set()
  )

  useEffect(() => {
    let cancelled = false
    Promise.all(
      (Object.keys(STRONG_BIBLE_PUBLICATIONS) as StrongBibleVersionId[]).map(async versionId => ({
        versionId,
        availability: await getStrongBibleSidecarAvailability(versionId),
      }))
    )
      .then(results => {
        if (cancelled) return
        setAvailableStrongVersions(
          new Set(
            results
              .filter(({ availability }) => availability.status === 'available')
              .map(({ versionId }) => versionId)
          )
        )
      })
      .catch(() => {
        if (!cancelled) setAvailableStrongVersions(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [downloadCompletionSignal])

  const handleVersionChange = (versionId: VersionCode) => {
    dispatch(setDefaultBibleVersion(versionId))
  }

  return (
    <Container>
      <VersionCatalogHeader
        title={t('bibleDefaults.title')}
        hasBackButton
        {...versionCatalog.headerProps}
      />
      <VersionCatalogList
        sections={versionCatalog.sections}
        grouping={versionCatalog.grouping}
        query={versionCatalog.query}
        openStyleInfo={versionCatalog.openStyleInfo}
        scrollToTopKey={versionCatalog.filterKey}
        listHeaderComponent={
          <Box paddingHorizontal={20} paddingVertical={15}>
            <Text fontSize={14} color="grey">
              {t('bibleDefaults.defaultVersionDescription')}
            </Text>
            <SelectedVersionCard code={selectedVersion.id} name={selectedVersionName} />
            <Text mt={28} fontSize={16} bold>
              {t('Bible Strong par défaut')}
            </Text>
            <Text mt={6} fontSize={14} color="grey">
              {t(
                "Utilisée pour les concordances lorsque la Bible ouverte n'a pas de données Strong installées."
              )}
            </Text>
            <Box mt={10} gap={8}>
              {(Object.keys(STRONG_BIBLE_PUBLICATIONS) as StrongBibleVersionId[]).map(
                strongVersionId => {
                  const strongVersion = versions[strongVersionId]
                  const isSelected = defaultStrongVersion === strongVersionId
                  const isAvailable = availableStrongVersions.has(strongVersionId)
                  return (
                    <TouchableBox
                      key={strongVersionId}
                      row
                      alignItems="center"
                      p={12}
                      borderRadius={10}
                      bg={isSelected ? 'lightGrey' : 'reverse'}
                      borderWidth={1}
                      borderColor={isSelected ? 'primary' : 'border'}
                      opacity={isAvailable ? 1 : 0.5}
                      onPress={
                        isAvailable
                          ? () => dispatch(setDefaultStrongBibleVersion(strongVersionId))
                          : undefined
                      }
                    >
                      <Box flex>
                        <Text bold={isSelected}>{strongVersion.name}</Text>
                        <Text mt={2} fontSize={12} color="grey">
                          {isAvailable
                            ? t('{{version}} · installé', { version: strongVersionId })
                            : t('{{version}} · à télécharger', { version: strongVersionId })}
                        </Text>
                      </Box>
                      {isSelected && <FeatherIcon name="check" size={18} color="primary" />}
                    </TouchableBox>
                  )
                }
              )}
            </Box>
          </Box>
        }
        renderItem={({ item: version }) => (
          <VersionSelectorItem
            version={version}
            isSelected={defaultVersion === version.id}
            onChange={handleVersionChange}
            onDownloadComplete={handleVersionChange}
          />
        )}
      />
      {versionCatalog.modals}
    </Container>
  )
}

export default BibleDefaultsScreen
