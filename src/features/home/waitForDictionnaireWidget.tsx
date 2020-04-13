import React from 'react'

import { useWaitForDatabase } from '~common/waitForDictionnaireDB'
import DownloadRequired from '~common/DownloadRequired'
import { DownloadingWidget, WidgetContainer, WidgetLoading } from './widget'

const waitForWidget = WrappedComponent => props => {
  const {
    isLoading,
    startDownload,
    proposeDownload,
    setStartDownload,
    progress,
  } = useWaitForDatabase()

  if (isLoading && startDownload) {
    return <DownloadingWidget progress={progress} />
  }

  if (isLoading && proposeDownload) {
    return (
      <WidgetContainer>
        <DownloadRequired
          noHeader
          title="Dictionnaire requis"
          setStartDownload={setStartDownload}
          fileSize={35}
          small
        />
      </WidgetContainer>
    )
  }

  if (isLoading) {
    return <WidgetLoading />
  }

  return <WrappedComponent {...props} />
}

export default waitForWidget
