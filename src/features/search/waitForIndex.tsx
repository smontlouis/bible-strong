import * as FileSystem from 'expo-file-system/legacy'
import React, { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import SnackBar from '~common/SnackBar'
import Progress from '~common/ui/Progress'
import { getDatabaseUrl } from '~helpers/firebase'
import { getDbPath, databases } from '~helpers/databases'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import type { ResourceLanguage } from '~helpers/databaseTypes'

const IDX_LIGHT_FILE_SIZE = 16795170

export const useWaitForIndex = () => {
  const { t } = useTranslation()
  const [isLoading, setLoading] = useState(true)
  const [proposeDownload, setProposeDownload] = useState(false)
  const [startDownload, setStartDownload] = useState(false)
  const [progress, setProgress] = useState<number>(0)
  const [idxFile, setIdxFile] = useState<FileSystem.FileInfo | null>(null)

  // Get current resource language from Jotai
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const resourceLang = resourcesLanguage.SEARCH

  const prevLangRef = useRef<ResourceLanguage>(resourceLang)

  useEffect(() => {
    // Reset state when language changes
    if (prevLangRef.current !== resourceLang) {
      prevLangRef.current = resourceLang
      setLoading(true)
      setProposeDownload(false)
      setStartDownload(false)
      setProgress(0)
      setIdxFile(null)
    }

    const loadIndex = async () => {
      const idxPath = getDbPath('SEARCH', resourceLang)
      let currentIdxFile = await FileSystem.getInfoAsync(idxPath)

      setIdxFile(currentIdxFile)

      if (!currentIdxFile.exists) {
        // Waiting for user to accept to download
        if (!startDownload) {
          setProposeDownload(true)
          return
        }

        const idxUri = getDatabaseUrl('SEARCH', resourceLang)

        console.log(`[Search] Downloading ${idxUri} to ${idxPath}`)

        // Ensure directory exists
        const dirPath = idxPath.substring(0, idxPath.lastIndexOf('/'))
        const dirInfo = await FileSystem.getInfoAsync(dirPath)
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true })
        }

        try {
          const fileSize = databases(resourceLang).SEARCH?.fileSize || IDX_LIGHT_FILE_SIZE
          await FileSystem.createDownloadResumable(
            idxUri,
            idxPath,
            undefined,
            ({ totalBytesWritten }) => {
              const idxProgress = Math.floor((totalBytesWritten / fileSize) * 100) / 100
              setProgress(idxProgress)
            }
          ).downloadAsync()

          console.log('[Search] Download finished')
          currentIdxFile = await FileSystem.getInfoAsync(idxPath)
          setIdxFile(currentIdxFile)
          setLoading(false)
        } catch (e) {
          console.log(e)
          SnackBar.show(
            t(
              "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet."
            ),
            'danger'
          )
          setProposeDownload(true)
          setStartDownload(false)
        }
      } else {
        setLoading(false)
      }
    }

    loadIndex()
  }, [startDownload, resourceLang, t])

  return {
    isLoading,
    idxFile,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
    resourceLang,
  }
}

const waitForIndex = (WrappedComponent: any) => (props: any) => {
  const { t } = useTranslation()
  const {
    isLoading,
    idxFile,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
    resourceLang,
  } = useWaitForIndex()

  if (isLoading && startDownload) {
    return (
      <Loading message={t("Téléchargement de l'index...")}>
        <Progress progress={progress} />
      </Loading>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <DownloadRequired
        title={t("L'index de recherche est requis pour accéder à cette page.")}
        setStartDownload={setStartDownload}
        fileSize={16}
        hasHeader={false}
      />
    )
  }

  if (idxFile && idxFile.exists) {
    return (
      <WrappedComponent
        key={resourceLang}
        idxFile={idxFile}
        resourceLang={resourceLang}
        {...props}
      />
    )
  }

  return <Loading message={t('Chargement...')} />
}

export default waitForIndex
