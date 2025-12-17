import { useTheme } from '@emotion/react'
import to from 'await-to-js'
import * as FileSystem from 'expo-file-system'
import { DownloadProgressData, FileSystemNetworkTaskProgressCallback } from 'expo-file-system'
import { useAtom } from 'jotai/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import ProgressCircle from 'react-native-progress/Circle'
import RNRestart from 'react-native-restart'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { VStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { selectedResourcesAtom } from './atom'

export interface DownloadResourcesProps {
  setFirstTime: React.Dispatch<React.SetStateAction<boolean>>
}

const DownloadResources = ({ setFirstTime }: DownloadResourcesProps) => {
  const [selectedResources] = useAtom(selectedResourcesAtom)
  const [downloadingResource, setDownloadingResource] = React.useState('')
  const [fileProgress, setFileProgress] = React.useState(0)
  const [downloadedResources, setDowloadedResources] = React.useState(0)
  const [error, setError] = React.useState<Error | null>(null)
  const { t } = useTranslation()
  const theme = useTheme()

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

      setFirstTime(false)
      RNRestart.Restart()
    })()
  }, [])

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
