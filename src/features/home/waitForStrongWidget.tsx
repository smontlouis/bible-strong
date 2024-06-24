import React from 'react'

import { useWaitForDatabase } from '~common/waitForStrongDB'
import DownloadRequired from '~common/DownloadRequired'
import { DownloadingWidget, WidgetContainer, WidgetLoading } from './widget'
import { useTranslation } from 'react-i18next'

const waitForWidget = (WrappedComponent: any) => (props: any) => {
  const { t } = useTranslation()

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
          hasHeader={false}
          size="small"
          title={t('Strong requis')}
          setStartDownload={setStartDownload}
          fileSize={35}
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
