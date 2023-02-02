import { useAtom } from 'jotai/react'
import React, { PropsWithChildren } from 'react'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import loadBible from '~helpers/loadBible'
import useAsync from '~helpers/useAsync'
import { defaultBibleAtom } from '../../state/tabs'

const PreloadBible = ({ children }: PropsWithChildren<{}>) => {
  const [bible] = useAtom(defaultBibleAtom)
  const { selectedVersion: version } = bible.data

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
