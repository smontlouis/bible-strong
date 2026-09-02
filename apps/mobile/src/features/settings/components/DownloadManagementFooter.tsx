import React from 'react'

import BatchActionBar from './BatchActionBar'
import GlobalDownloadBar from './GlobalDownloadBar'

type BatchActionBarProps = React.ComponentProps<typeof BatchActionBar>

const DownloadManagementFooter = (props: BatchActionBarProps) =>
  props.selectedCount > 0 ? <BatchActionBar {...props} /> : <GlobalDownloadBar />

export default DownloadManagementFooter
