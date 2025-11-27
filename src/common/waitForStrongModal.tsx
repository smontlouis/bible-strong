import React from 'react'

import DownloadRequired from '~common/DownloadRequired'
import Loading from '~common/Loading'
import { useWaitForDatabase } from '~common/waitForStrongDB'
import Progress from './ui/Progress'

const waitForModal = (WrappedComponent) => (props) => {
  const {
    isLoading,
    startDownload,
    proposeDownload,
    setStartDownload,
    progress,
    resourceLang,
  } = useWaitForDatabase()

  if (isLoading && startDownload) {
    return (
      <Loading message="Téléchargement de la base strong...">
        <Progress progress={progress} />
      </Loading>
    )
  }

  if (isLoading && proposeDownload) {
    return (
      <DownloadRequired
        hasHeader={false}
        size="small"
        title="La base de données strong est requise pour accéder à cette page."
        setStartDownload={setStartDownload}
        fileSize={35}
      />
    )
  }

  if (isLoading) {
    return (
      <Loading
        message="Chargement de la base strong..."
        subMessage="Merci de patienter, la première fois peut prendre plusieurs secondes... Si au bout de 30s il ne se passe rien, n'hésitez pas à redémarrer l'app."
      />
    )
  }

  return <WrappedComponent key={resourceLang} {...props} />
}

export default waitForModal
