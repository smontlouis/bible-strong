import { useQuery } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'

import { useTranslation } from 'react-i18next'
import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import Box from './ui/Box'
import Progress from './ui/Progress'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { createStrongLexiconModuleDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import { getStrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { createOfflineCopyId } from '~helpers/offlineCopyId'

export const useWaitForDatabase = () => {
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const resourceLang = resourcesLanguage.STRONG
  const [startDownload, setStartDownload] = useState(false)
  const download = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'core' })
  )
  const availabilityQuery = useQuery({
    queryKey: ['strong-lexicon', 'availability', 'core'],
    queryFn: () => getStrongLexiconModuleAvailability('core'),
    networkMode: 'always',
  })
  const availability = availabilityQuery.data
  const active =
    download?.status === 'queued' ||
    download?.status === 'downloading' ||
    download?.status === 'inserting'
  const downloadFailed = download?.status === 'failed' || download?.status === 'cancelled'
  const downloadRequested = startDownload && !downloadFailed
  const requestDownload = (value: boolean) => {
    if (value && download?.status === 'failed') {
      downloadManager.retry(
        createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'core' })
      )
    } else if (value && download?.status === 'cancelled') {
      downloadManager.enqueue([createStrongLexiconModuleDownloadItem('core')])
    }
    setStartDownload(value)
  }

  useEffect(() => {
    if (!downloadRequested || availability?.status === 'available' || active) return
    downloadManager.enqueue([createStrongLexiconModuleDownloadItem('core')])
  }, [active, availability?.status, downloadRequested])

  const isLoading = availabilityQuery.isPending || availability?.status !== 'available'
  const proposeDownload = isLoading && !active
  const progress = download
    ? download.status === 'inserting'
      ? 0.8 + download.insertProgress * 0.2
      : download.downloadProgress * 0.8
    : 0

  return {
    isLoading,
    progress,
    proposeDownload,
    startDownload: downloadRequested,
    setStartDownload: requestDownload,
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
