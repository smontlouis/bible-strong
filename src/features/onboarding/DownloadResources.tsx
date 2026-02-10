import { useTheme } from '@emotion/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { useAtom, useSetAtom } from 'jotai/react'
import { useAtomValue } from 'jotai/react'
import Animated from 'react-native-reanimated'

import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { VStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
import { isStrongVersion } from '~helpers/bibleVersions'
import { isVersionInstalled } from '~helpers/biblesDb'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { requireBiblePath } from '~helpers/requireBiblePath'
import { createBibleDownloadItem, createDatabaseDownloadItem } from '~helpers/downloadItemFactory'
import type { DatabaseId } from '~helpers/databaseTypes'
import { downloadManager } from '~helpers/downloadManager'
import { overallProgressAtom, activeQueueAtom, failedItemsAtom } from '~state/downloadQueue'
import { isOnboardingCompletedAtom, selectedResourcesAtom } from './atom'

import * as FileSystem from 'expo-file-system/legacy'

const DownloadResources = () => {
  const [selectedResources] = useAtom(selectedResourcesAtom)
  const setIsOnboardingCompleted = useSetAtom(isOnboardingCompletedAtom)
  const [error, setError] = React.useState<Error | null>(null)
  const { t } = useTranslation()
  const theme = useTheme()
  const lang = useLanguage()

  const progress = useAtomValue(overallProgressAtom)
  const activeQueue = useAtomValue(activeQueueAtom)
  const failedItems = useAtomValue(failedItemsAtom)

  // Enqueue all resources on mount
  useEffect(() => {
    const items = selectedResources.map(resource => {
      try {
        if (resource.type === 'bible') {
          return createBibleDownloadItem(resource.id)
        } else {
          // Database: use the language that was stored when resource was selected
          return createDatabaseDownloadItem(
            resource.id as DatabaseId,
            resource.lang || 'fr'  // Fallback to 'fr' for safety
          )
        }
      } catch (error) {
        // Log error but don't crash the app
        console.error(`Failed to create download item for ${resource.id}:`, error)
        throw error  // Re-throw to trigger the error UI
      }
    })

    if (items.length > 0) {
      downloadManager.enqueue(items)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Watch for completion (all active items done)
  useEffect(() => {
    // If queue was started and is now empty, check completion
    if (activeQueue.length === 0 && progress.total > 0 && progress.completed === progress.total) {
      verifyAndComplete()
    }
  }, [activeQueue.length, progress.total, progress.completed])

  // Watch for failures
  useEffect(() => {
    if (failedItems.length > 0) {
      setError(new Error(failedItems[0].error || 'Download failed'))
    }
  }, [failedItems.length])

  const verifyAndComplete = async () => {
    // Verify that the default Bible was downloaded successfully
    const defaultVersion = getDefaultBibleVersion(lang)
    const installed = await isVersionInstalled(defaultVersion)
    if (!installed) {
      const defaultBiblePath = requireBiblePath(defaultVersion)
      const fileInfo = await FileSystem.getInfoAsync(defaultBiblePath)
      if (!fileInfo.exists) {
        setError(new Error(`Download verification failed: Bible ${defaultVersion} not found`))
        return
      }
    }

    downloadManager.clearCompleted()
    setIsOnboardingCompleted(true)
  }

  const displayProgress = progress.total > 0 ? progress.progress : 0

  return (
    <Container center>
      {error ? (
        <VStack px={40}>
          <Text title fontSize={20} color="quart">
            {t('Une erreur est survenue')}
          </Text>
          <Text>{error.message}</Text>
        </VStack>
      ) : (
        <>
          {/* Circular-style progress using a simple ring */}
          <Box size={100} center>
            <Box
              size={100}
              borderRadius={50}
              borderWidth={5}
              borderColor="border"
              center
              overflow="visible"
            >
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 50,
                  borderWidth: 5,
                  borderColor: theme.colors.primary,
                  opacity: displayProgress,
                  transitionProperty: 'opacity',
                  transitionDuration: 300,
                }}
              />
              <Text fontSize={20}>
                {progress.completed} / {progress.total || selectedResources.length}
              </Text>
            </Box>
          </Box>
          <Box center mt={20}>
            <Text opacity={0.6}>{t('app.downloading')}</Text>
            <Text bold>{Math.round(displayProgress * 100)}%</Text>
          </Box>
        </>
      )}
    </Container>
  )
}

export default DownloadResources
