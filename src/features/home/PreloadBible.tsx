import React, { PropsWithChildren } from 'react'
import { useSelector } from 'react-redux'
import useAsync from '~helpers/useAsync'
import loadBible from '~helpers/loadBible'
import { RootState } from '~redux/modules/reducer'
import Box from '~common/ui/Box'
import Loading from '~common/Loading'

const PreloadBible = ({ children }: PropsWithChildren<{}>) => {
  const version = useSelector((state: RootState) => state.bible.selectedVersion)
  const { status } = useAsync(async () => await loadBible(version))

  if (status === 'Resolved') {
    return children
  }

  return (
    <Box height={50}>
      <Loading />
    </Box>
  )
}

export default PreloadBible
