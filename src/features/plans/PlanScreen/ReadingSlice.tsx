import React from 'react'

import styled from '~styled'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Border from '~common/ui/Border'
import { FeatherIcon } from '~common/ui/Icon'
import { ComputedReadingSlice } from '~common/types'
import Link from '~common/Link'
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

interface Props {
  isLast?: boolean
  planId: string
  isSectionCompleted: boolean
}

const ReadingSlice = ({
  id,
  planId,
  slices,
  status,
  isLast,
  isSectionCompleted,
}: ComputedReadingSlice & Props) => {
  const isNext = status === 'Next'
  return (
    <Link route="PlanSlice" params={{ readingSlice: { id, planId, slices } }}>
      <Box
        paddingLeft={28}
        paddingTop={15}
        backgroundColor="lightGrey"
        position="relative"
      >
        <FineLine />
        <Box row marginBottom={15}>
          <Box flex>
            {slices
              .filter(f => f.type !== 'Image')
              .map((slice, i) => (
                <EntitySlice
                  status={status}
                  isSectionCompleted={isSectionCompleted}
                  isLast={
                    i === slices.filter(f => f.type !== 'Image').length - 1
                  }
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
    </Link>
  )
}

export default ReadingSlice
