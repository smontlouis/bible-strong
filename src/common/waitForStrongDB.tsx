import * as FileSystem from 'expo-file-system/legacy'
import React, { useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai'

import { useTranslation } from 'react-i18next'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { toast } from 'sonner-native'
import { dbManager, initSQLiteDirForLang } from '~helpers/sqlite'
import { useDBStateValue } from '~helpers/databaseState'
import { getDatabaseUrl } from '~helpers/firebase'
import { getDbPath, databases } from '~helpers/databases'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import Box from './ui/Box'
import Progress from './ui/Progress'

const STRONG_FILE_SIZE = 34941952

const useStrong = (dispatch: any, startDownload: any, lang: ResourceLanguage) => {
  const { t } = useTranslation()
  const prevLangRef = useRef<ResourceLanguage>(lang)

  useEffect(() => {
    // Detect if this is a language change
    const isLangChange = prevLangRef.current !== lang

    // Reset state when language changes
    if (isLangChange) {
      prevLangRef.current = lang
      dispatch({ type: 'strong.setLoading', payload: true })
      dispatch({ type: 'strong.setProposeDownload', payload: false })
      dispatch({ type: 'strong.setStartDownload', payload: false })
      dispatch({ type: 'strong.setProgress', payload: 0 })
    }

    const db = dbManager.getDB('STRONG', lang)

    if (db.get()) {
      dispatch({
        type: 'strong.setLoading',
        payload: false,
      })
    } else {
      const loadDBAsync = async () => {
        const dbPath = getDbPath('STRONG', lang)
        const dbFile = await FileSystem.getInfoAsync(dbPath)

        if (!dbFile.exists) {
          await initSQLiteDirForLang(lang)

          // Waiting for user to accept to download
          // Also prevent auto-download when language changes
          if (!startDownload || isLangChange) {
            dispatch({
              type: 'strong.setProposeDownload',
              payload: true,
            })
            return
          }

          try {
            const downloadKey = `strongDownloadHasStarted_${lang}`
            if (!(window as any)[downloadKey]) {
              ;(window as any)[downloadKey] = true

              const sqliteDbUri = getDatabaseUrl('STRONG', lang)

              console.log(`[Strong] Downloading ${sqliteDbUri} to ${dbPath}`)

              await initSQLiteDirForLang(lang)

              await FileSystem.createDownloadResumable(
                sqliteDbUri,
                dbPath,
                undefined,
                ({ totalBytesWritten }) => {
                  const idxProgress = Math.floor((totalBytesWritten / STRONG_FILE_SIZE) * 100) / 100
                  dispatch({
                    type: 'strong.setProgress',
                    payload: idxProgress,
                  })
                }
              ).downloadAsync()

              await db.init()

              dispatch({
                type: 'strong.setLoading',
                payload: false,
              })
              ;(window as any)[downloadKey] = false
            }
          } catch (e) {
            console.log('[Strong] Download error:', e)
            toast.error(
              t(
                "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet."
              )
            )
            dispatch({
              type: 'strong.setProposeDownload',
              payload: true,
            })
            dispatch({
              type: 'strong.setStartDownload',
              payload: false,
            })
          }
        } else {
          await db.init()

          dispatch({
            type: 'strong.setLoading',
            payload: false,
          })
        }
      }

      loadDBAsync()
    }
  }, [dispatch, startDownload, lang, t])
}

export const useWaitForDatabase = () => {
  const [
    {
      strong: { isLoading, proposeDownload, startDownload, progress },
    },
    dispatch,
  ] = useDBStateValue()

  // Get current resource language from Jotai
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const resourceLang = resourcesLanguage.STRONG

  useStrong(dispatch, startDownload, resourceLang)

  const setStartDownload = (value: boolean) => {
    dispatch({
      type: 'strong.setStartDownload',
      payload: value,
    })
  }

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
          <Loading message={t('Téléchargement de la base strong...')}>
            <Progress progress={progress} />
          </Loading>
        </Box>
      )
    }

    if (isLoading && proposeDownload) {
      return (
        <DownloadRequired
          hasBackButton={hasBackButton}
          size={size}
          hasHeader={hasHeader}
          title={t('La base de données strong est requise pour accéder à cette page.')}
          setStartDownload={setStartDownload}
          fileSize={35}
        />
      )
    }

    if (isLoading) {
      return (
        <Loading
          message={t('Chargement de la base strong...')}
          subMessage="Merci de patienter, la première fois peut prendre plusieurs secondes... Si au bout de 30s il ne se passe rien, n'hésitez pas à redémarrer l'app."
        />
      )
    }

    return <WrappedComponent key={resourceLang} {...props} />
  }

export default waitForDatabase
