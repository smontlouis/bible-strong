import * as FileSystem from 'expo-file-system/legacy'
import React, { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useAtomValue } from 'jotai'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { toast } from 'sonner-native'
import bibleMemoize from '~helpers/bibleStupidMemoize'
import { getDbPath, databases } from '~helpers/databases'
import { getDatabaseUrl } from '~helpers/firebase'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { hp } from '~helpers/utils'
import Box from './ui/Box'
import Progress from './ui/Progress'

export const useWaitForDatabase = () => {
  const { t } = useTranslation()
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState<number>(0)
  const dispatch = useDispatch()

  // Get current resource language from Jotai
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const resourceLang = resourcesLanguage.TIMELINE

  const prevLangRef = useRef<ResourceLanguage>(resourceLang)

  useEffect(() => {
    // Reset state when language changes
    if (prevLangRef.current !== resourceLang) {
      prevLangRef.current = resourceLang
      setLoading(true)
      setProposeDownload(false)
      setStartDownload(false)
      setProgress(0)
      // Clear memoized data for the old language
      delete bibleMemoize[`timeline_${prevLangRef.current}`]
    }

    const loadDBAsync = async () => {
      const path = getDbPath('TIMELINE', resourceLang)
      const file = await FileSystem.getInfoAsync(path)

      // Use language-specific cache key
      const cacheKey = `timeline_${resourceLang}`

      if (!file.exists) {
        // Waiting for user to accept to download
        if (!startDownload) {
          setProposeDownload(true)
          return
        }

        try {
          const fileUri = getDatabaseUrl('TIMELINE', resourceLang)

          console.log(`[Timeline] Downloading ${fileUri} to ${path}`)

          // Ensure directory exists
          const dirPath = path.substring(0, path.lastIndexOf('/'))
          const dirInfo = await FileSystem.getInfoAsync(dirPath)
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(dirPath, {
              intermediates: true,
            })
          }

          await FileSystem.createDownloadResumable(
            fileUri,
            path,
            undefined,
            ({ totalBytesWritten }) => {
              const fileSize = databases(resourceLang).TIMELINE.fileSize
              const idxProgress = Math.floor((totalBytesWritten / fileSize) * 100) / 100
              setProgress(idxProgress)
            }
          ).downloadAsync()

          if (bibleMemoize[cacheKey]) {
            setLoading(false)
            return
          }

          const data = await FileSystem.readAsStringAsync(path || '')
          bibleMemoize[cacheKey] = JSON.parse(data)
          // Keep backward compatibility
          bibleMemoize.timeline = bibleMemoize[cacheKey]
          setLoading(false)
        } catch (e) {
          console.log('[Timeline] Download error:', e)
          toast.error(
            t("Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.")
          )
          setProposeDownload(true)
          setStartDownload(false)
        }
      } else {
        if (bibleMemoize[cacheKey]) {
          setLoading(false)
          return
        }

        const data = await FileSystem.readAsStringAsync(path || '')
        bibleMemoize[cacheKey] = JSON.parse(data)
        // Keep backward compatibility
        bibleMemoize.timeline = bibleMemoize[cacheKey]
        setLoading(false)
      }
    }

    loadDBAsync()
  }, [dispatch, startDownload, resourceLang, t])

  return {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
    resourceLang,
  }
}

const waitForDatabase = (WrappedComponent: React.ComponentType<any>) => (props: any) => {
  const { t } = useTranslation()
  const { isLoading, progress, proposeDownload, startDownload, setStartDownload, resourceLang } =
    useWaitForDatabase()

  if (isLoading && startDownload) {
    return (
      <Box center height={hp(80)}>
        <Loading message={t('Téléchargement de la chronologie...')}>
          <Progress progress={progress} />
        </Loading>
      </Box>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <Box center height={hp(80)}>
        <DownloadRequired
          title={t('La chronologie biblique est requise pour accéder à ce module.')}
          setStartDownload={setStartDownload}
          fileSize={Math.round(databases(resourceLang).TIMELINE.fileSize / 1000000)}
        />
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box height={hp(80)} center>
        <Loading
          message={t('Chargement de la base de données...')}
          subMessage={t(
            "Merci de patienter, la première fois peut prendre plusieurs secondes... Si au bout de 30s il ne se passe rien, n'hésitez pas à redémarrer l'app."
          )}
        />
      </Box>
    )
  }

  return <WrappedComponent key={resourceLang} {...props} />
}

export default waitForDatabase
