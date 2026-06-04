import React from 'react'
import { useAtomValue } from 'jotai'

import { useTranslation } from 'react-i18next'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { DBAction, useDBStateValue } from '~helpers/databaseState'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import Box from './ui/Box'
import Progress from './ui/Progress'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResourceDatabaseAccess } from './resourceDatabaseAccess'

const STRONG_FILE_SIZE = 34941952

const useStrong = (
  dispatch: React.Dispatch<DBAction>,
  startDownload: boolean,
  lang: ResourceLanguage
) => {
  useResourceDatabaseAccess({
    dbId: 'STRONG',
    fileSize: STRONG_FILE_SIZE,
    downloadKeyPrefix: 'strongDownloadHasStarted',
    logName: 'Strong',
    ensureDirBeforePrompt: true,
    state: { startDownload, lang },
    actions: {
      setLoading: value => dispatch({ type: 'strong.setLoading', payload: value }),
      setProposeDownload: value => dispatch({ type: 'strong.setProposeDownload', payload: value }),
      setStartDownload: value => dispatch({ type: 'strong.setStartDownload', payload: value }),
      setProgress: value => dispatch({ type: 'strong.setProgress', payload: value }),
    },
  })
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
    useStackBackButton,
  }: {
    hasBackButton?: boolean
    size?: 'small' | 'large'
    hasHeader?: boolean
    useStackBackButton?: boolean
  } = {}) =>
  <T extends object>(WrappedComponent: React.ComponentType<T>): React.ComponentType<T> =>
  (props: T) => {
    const { t } = useTranslation()
    const canGoBackInStack = useCanGoBackInStack()
    const effectiveHasBackButton = useStackBackButton ? canGoBackInStack : hasBackButton
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
          hasBackButton={effectiveHasBackButton}
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
