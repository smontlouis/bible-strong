import React from 'react'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Border from '~common/ui/Border'
import { FeatherIcon } from '~common/ui/Icon'
import { ComputedReadingSlice } from '~common/types'
import EntitySlice from './EntitySlice'

const FineLine = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 35,
  width: 2,
  backgroundColor: theme.colors.lightPrimary,
}))

const NextButton = styled(Text)(({ theme }) => ({
  padding: 4,
  borderRadius: 3,
  backgroundColor: theme.colors.primary,
  color: 'white',
  fontSize: 11,
  fontWeight: 'bold',
  marginRight: 10,
}))

const ReadingSlice = ({
  id,
  slices,
  status,
  isLast,
}: ComputedReadingSlice & { isLast?: boolean }) => {
  const isNext = status === 'Next'
  return (
    <>
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
                status={status}
                isLast={i === slices.length - 1}
                key={slice.id}
                {...slice}
              />
            ))}
          </Box>
          <Box paddingHorizontal={10} alignItems="center" row>
            {isNext && <NextButton>LIRE</NextButton>}
            <FeatherIcon name="chevron-right" size={14} color="primary" />
          </Box>
        </Box>
        {!isLast && <Border marginLeft={40} />}
      </Box>
      {isLast && <Border />}
    </>
  )
}

export default ReadingSlice
