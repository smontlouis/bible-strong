import * as FileSystem from 'expo-file-system/legacy'
import React, { useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai'

import { useTranslation } from 'react-i18next'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { toast } from '~helpers/toast'
import { dbManager, initSQLiteDirForLang } from '~helpers/sqlite'
import { useDBStateValue } from '~helpers/databaseState'
import { getDatabaseUrl } from '~helpers/firebase'
import { getDbPath } from '~helpers/databases'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import Box from './ui/Box'
import Progress from './ui/Progress'

const DICTIONNAIRE_FILE_SIZE = 22532096

export const useWaitForDatabase = () => {
  const { t } = useTranslation()
  const [
    {
      dictionnaire: { isLoading, proposeDownload, startDownload, progress },
    },
    dispatch,
  ] = useDBStateValue()

  // Get current resource language from Jotai
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const resourceLang = resourcesLanguage.DICTIONNAIRE

  const prevLangRef = useRef<ResourceLanguage>(resourceLang)

  useEffect(() => {
    // Detect if this is a language change
    const isLangChange = prevLangRef.current !== resourceLang

    // Reset state when language changes
    if (isLangChange) {
      prevLangRef.current = resourceLang
      dispatch({ type: 'dictionnaire.setLoading', payload: true })
      dispatch({ type: 'dictionnaire.setProposeDownload', payload: false })
      dispatch({ type: 'dictionnaire.setStartDownload', payload: false })
      dispatch({ type: 'dictionnaire.setProgress', payload: 0 })
    }

    const db = dbManager.getDB('DICTIONNAIRE', resourceLang)

    if (db.get()) {
      dispatch({
        type: 'dictionnaire.setLoading',
        payload: false,
      })
    } else {
      const loadDBAsync = async () => {
        const dbPath = getDbPath('DICTIONNAIRE', resourceLang)
        const dbFile = await FileSystem.getInfoAsync(dbPath)

        if (!dbFile.exists) {
          await initSQLiteDirForLang(resourceLang)

          // Waiting for user to accept to download
          // Also prevent auto-download when language changes
          if (!startDownload || isLangChange) {
            dispatch({
              type: 'dictionnaire.setProposeDownload',
              payload: true,
            })
            return
          }

          try {
            const downloadKey = `dictionnaireDownloadHasStarted_${resourceLang}`
            if (!(window as any)[downloadKey]) {
              ;(window as any)[downloadKey] = true

              const sqliteDbUri = getDatabaseUrl('DICTIONNAIRE', resourceLang)

              console.log(`[Dictionnaire] Downloading ${sqliteDbUri} to ${dbPath}`)

              await initSQLiteDirForLang(resourceLang)

              await FileSystem.createDownloadResumable(
                sqliteDbUri,
                dbPath,
                undefined,
                ({ totalBytesWritten }) => {
                  const idxProgress =
                    Math.floor((totalBytesWritten / DICTIONNAIRE_FILE_SIZE) * 100) / 100
                  dispatch({
                    type: 'dictionnaire.setProgress',
                    payload: idxProgress,
                  })
                }
              ).downloadAsync()

              await db.init()

              dispatch({
                type: 'dictionnaire.setLoading',
                payload: false,
              })
              ;(window as any)[downloadKey] = false
            }
          } catch (e) {
            toast.error(
              t(
                "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet."
              )
            )
            dispatch({
              type: 'dictionnaire.setProposeDownload',
              payload: true,
            })
            dispatch({
              type: 'dictionnaire.setStartDownload',
              payload: false,
            })
          }
        } else {
          await db.init()

          dispatch({
            type: 'dictionnaire.setLoading',
            payload: false,
          })
        }
      }

      loadDBAsync()
    }
  }, [dispatch, startDownload, resourceLang, t])

  const setStartDownload = (value: boolean) =>
    dispatch({
      type: 'dictionnaire.setStartDownload',
      payload: value,
    })

  return {
    isLoading,
    progress,
    proposeDownload,
    startDownload,
    setStartDownload,
    resourceLang,
  }
}

const waitForDatabase =
  ({
    hasBackButton,
    hasHeader,
    size,
  }: {
    hasBackButton?: boolean
    size?: 'small' | 'large'
    hasHeader?: boolean
  } = {}) =>
  <T,>(WrappedComponent: React.ComponentType<T>): React.ComponentType<T> =>
  (props: any) => {
    const { t } = useTranslation()
    const { isLoading, progress, proposeDownload, startDownload, setStartDownload, resourceLang } =
      useWaitForDatabase()

    if (isLoading && startDownload) {
      return (
        <Box h={300} alignItems="center">
          <Loading message={t('Téléchargement du dictionnaire...')}>
            <Progress progress={progress} />
          </Loading>
        </Box>
      )
    }

    if (isLoading && proposeDownload) {
      return (
        <DownloadRequired
          hasBackButton={hasBackButton}
          hasHeader={hasHeader}
          size={size}
          title={t('La base de données dictionnaire est requise pour accéder à cette page.')}
          setStartDownload={setStartDownload}
          fileSize={22}
        />
      )
    }

    if (isLoading) {
      return (
        <Loading
          message={t('Chargement du dictionnaire...')}
          subMessage={t('Merci de patienter, la première fois peut prendre plusieurs secondes...')}
        />
      )
    }
    return <WrappedComponent key={resourceLang} {...props} />
  }

export default waitForDatabase
