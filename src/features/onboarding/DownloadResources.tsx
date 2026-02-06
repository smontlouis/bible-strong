import { useTheme } from '@emotion/react'
import to from 'await-to-js'
import * as FileSystem from 'expo-file-system/legacy'
import {
  DownloadProgressData,
  FileSystemNetworkTaskProgressCallback,
} from 'expo-file-system/legacy'
import { useAtom, useSetAtom } from 'jotai/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { AnimatedProgressCircle } from '@convective/react-native-reanimated-progress'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { VStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
import { isStrongVersion } from '~helpers/bibleVersions'
import { isVersionInstalled } from '~helpers/biblesDb'
import { downloadAndInsertBible } from '~helpers/downloadBibleToSqlite'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { requireBiblePath } from '~helpers/requireBiblePath'
import { downloadRedWordsFile, versionHasRedWords } from '~helpers/redWords'
import { downloadPericopeFile, versionHasPericope } from '~helpers/pericopes'
import { isOnboardingCompletedAtom, selectedResourcesAtom } from './atom'

const DownloadResources = () => {
  const [selectedResources] = useAtom(selectedResourcesAtom)
  const setIsOnboardingCompleted = useSetAtom(isOnboardingCompletedAtom)
  const [downloadingResource, setDownloadingResource] = React.useState('')
  const [fileProgress, setFileProgress] = React.useState(0)
  const [downloadedResources, setDowloadedResources] = React.useState(0)
  const [error, setError] = React.useState<Error | null>(null)
  const { t } = useTranslation()
  const theme = useTheme()
  const lang = useLanguage()

  const calculateProgress: (
    fileSize: number
  ) => FileSystemNetworkTaskProgressCallback<DownloadProgressData> =
    (fileSize: number) =>
    ({ totalBytesWritten }) => {
      setFileProgress(Math.floor((totalBytesWritten / fileSize) * 100) / 100)
    }

  useEffect(() => {
    ;(async () => {
      for (const resource of selectedResources) {
        setDownloadingResource(resource.name)
        setDowloadedResources(s => s + 1)

        // Use SQLite path for regular Bible versions, file download for others
        if (!isStrongVersion(resource.id) && resource.path.endsWith('.json')) {
          // Regular Bible: download JSON -> insert into bibles.sqlite
          const [err] = await to(
            downloadAndInsertBible(resource.id, resource.uri, calculateProgress(resource.fileSize))
          )

          if (err) {
            setError(err)
            return
          }
        } else {
          // Strong/Interlinear/database: download file directly
          const [err] = await to(
            FileSystem.createDownloadResumable(
              resource.uri,
              resource.path,
              undefined,
              calculateProgress(resource.fileSize)
            ).downloadAsync()
          )

          if (err) {
            setError(err)
            return
          }
        }

        if (versionHasRedWords(resource.id)) {
          downloadRedWordsFile(resource.id)
        }

        if (versionHasPericope(resource.id)) {
          downloadPericopeFile(resource.id)
        }
      }

      // Verify that the default Bible was downloaded successfully
      const defaultVersion = getDefaultBibleVersion(lang)
      const installed = await isVersionInstalled(defaultVersion)
      if (!installed) {
        // Fallback: check legacy file path
        const defaultBiblePath = requireBiblePath(defaultVersion)
        const fileInfo = await FileSystem.getInfoAsync(defaultBiblePath)
        if (!fileInfo.exists) {
          setError(new Error(`Download verification failed: Bible ${defaultVersion} not found`))
          return
        }
      }

      // Mark onboarding as complete - persisted in MMKV for instant starts
      setIsOnboardingCompleted(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only once on mount - download should not restart on dependency changes

  return (
    <Container center>
      {error ? (
        <VStack px={40}>
          <Text title fontSize={20} color="quart">
            {t('Une erreur est survenue')}
          </Text>
          <Text>{downloadingResource}</Text>
          <Text>{error.message}</Text>
        </VStack>
      ) : (
        <>
          <AnimatedProgressCircle
            size={100}
            progress={fileProgress}
            thickness={5}
            color={theme.colors.primary}
            unfilledColor={theme.colors.lightGrey}
            animationDuration={300}
          >
            <Box style={StyleSheet.absoluteFillObject} center>
              <Text fontSize={20}>
                {downloadedResources} / {selectedResources.length}
              </Text>
            </Box>
          </AnimatedProgressCircle>
          <Box center mt={20}>
            <Text opacity={0.6}>{t('app.downloading')}</Text>
            <Text bold>{downloadingResource}</Text>
          </Box>
        </>
      )}
    </Container>
  )
}

export default DownloadResources
