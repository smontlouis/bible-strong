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
import ProgressCircle from 'react-native-progress/Circle'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { VStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { requireBiblePath } from '~helpers/requireBiblePath'
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

      // Verify that the default Bible file was downloaded successfully
      const defaultBiblePath = requireBiblePath(getDefaultBibleVersion(lang))
      const fileInfo = await FileSystem.getInfoAsync(defaultBiblePath)
      if (!fileInfo.exists) {
        setError(
          new Error(`Download verification failed: Bible file not found at ${defaultBiblePath}`)
        )
        return
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
          <ProgressCircle
            size={100}
            progress={fileProgress}
            borderWidth={0}
            thickness={5}
            color={theme.colors.primary}
            unfilledColor={theme.colors.lightGrey}
            fill="none"
          >
            <Box style={StyleSheet.absoluteFillObject} center>
              <Text fontSize={20}>
                {downloadedResources} / {selectedResources.length}
              </Text>
            </Box>
          </ProgressCircle>
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
