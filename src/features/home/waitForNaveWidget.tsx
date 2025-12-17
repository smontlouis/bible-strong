import React from 'react'

import { useWaitForDatabase } from '~common/waitForNaveDB'
import DownloadRequired from '~common/DownloadRequired'
import { DownloadingWidget, WidgetLoading, WidgetContainer } from './widget'
import { useTranslation } from 'react-i18next'

const waitForWidget = (WrappedComponent: any) => (props: any) => {
  const { t } = useTranslation()
  const { isLoading, startDownload, proposeDownload, setStartDownload, progress, resourceLang } =
    useWaitForDatabase()

  if (isLoading && startDownload) {
    return <DownloadingWidget progress={progress} />
  }

  if (isLoading && proposeDownload) {
    return (
      <WidgetContainer>
        <DownloadRequired
          hasHeader={false}
          size="small"
          title={t('Thématique nave requise')}
          setStartDownload={setStartDownload}
          fileSize={7}
        />
      </WidgetContainer>
    )
  }

  if (isLoading) {
    return <WidgetLoading />
  }

  return <WrappedComponent key={resourceLang} {...props} />
}

export default waitForWidget
