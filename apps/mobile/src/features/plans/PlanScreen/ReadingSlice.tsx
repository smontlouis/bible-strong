import React from 'react'

import styled from '@emotion/native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Border from '~common/ui/Border'
import { FeatherIcon } from '~common/ui/Icon'
import { ComputedReadingSlice, Plan } from '~common/types'
import Link from '~common/Link'
import EntitySlice from './EntitySlice'

const FineLine = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 36,
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
  planTitle: string
  planLanguage?: Plan['lang']
  isSectionCompleted: boolean
  onPress?: (
    slice: ComputedReadingSlice & {
      planId: string
      planTitle: string
      planLanguage?: Plan['lang']
    }
  ) => void
}

const ReadingSlice = ({
  id,
  title,
  planId,
  planTitle,
  planLanguage,
  slices,
  status,
  isLast,
  isSectionCompleted,
  onPress,
}: ComputedReadingSlice & Props) => {
  const isNext = status === 'Next'
  // Pre-filter slices to avoid double filtering in map
  const filteredSlices = slices.filter(f => f.type !== 'Image')
  const readingSlice = { id, planId, planTitle, planLanguage, title, slices, status }

  return (
    <Link
      route={onPress ? undefined : 'PlanSlice'}
      params={onPress ? undefined : { readingSlice }}
      onPress={onPress ? () => onPress(readingSlice) : undefined}
    >
      <Box paddingLeft={28} paddingTop={15} backgroundColor="reverse" position="relative">
        <FineLine />
        <Box row marginBottom={15}>
          <Box flex>
            {title && (
              <EntitySlice
                id={title}
                status={status}
                isSectionCompleted={isSectionCompleted}
                title={title}
                isLast
                type="Title"
              />
            )}
            {filteredSlices.map((slice, i) => (
              <EntitySlice
                status={status}
                isSectionCompleted={isSectionCompleted}
                isLast={i === filteredSlices.length - 1}
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
