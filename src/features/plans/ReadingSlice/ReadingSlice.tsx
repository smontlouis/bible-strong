import React from 'react'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import { FeatherIcon } from '~common/ui/Icon'
import { MyReadingSlice as MyReadingSliceProps } from '~common/types'
import EntitySlice from './EntitySlice'

const FineLine = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 35,
  width: 2,
  backgroundColor: theme.colors.lightPrimary,
}))

const ReadingSlice = ({
  id,
  description,
  slices,
  isComplete,
  isLast,
}: MyReadingSliceProps & { isLast?: boolean }) => (
  <Box
    paddingLeft={28}
    paddingTop={15}
    backgroundColor="lightGrey"
    position="relative"
  >
    <FineLine />
    <Box row marginBottom={15}>
      <Box flex>
        {slices.map((slice, i) => (
          <EntitySlice
            isComplete={isComplete}
            isLast={i === slices.length - 1}
            key={slice.id}
            {...slice}
          />
        ))}
      </Box>
      <Box width={20} justifyContent="center">
        <FeatherIcon name="chevron-right" size={14} color="primary" />
      </Box>
    </Box>
    {!isLast && <Border marginLeft={40} />}
  </Box>
)

export default ReadingSlice
