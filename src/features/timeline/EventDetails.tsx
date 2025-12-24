import React, { useMemo } from 'react'
import useLanguage from '~helpers/useLanguage'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import waitForTimeline from '~common/waitForTimeline'
import bibleMemoize from '~helpers/bibleStupidMemoize'
import { calculateLabel } from './constants'
import { useEventDetailsModal } from './EventDetailsModalContext'
import { TimelineEventDetail, TimelineEvent as TimelineEventProps } from './types'
import { Image } from 'expo-image'
import Media from './EventDetailsMedia'

const Description = ({ description, article }: Partial<TimelineEventDetail>) => {
  return (
    <Box px={20}>
      <Paragraph fontFamily="title" mb={10}>
        Description
      </Paragraph>
      <Paragraph fontWeight="bold" scale={-1}>
        {description}
      </Paragraph>
      <Paragraph marginTop={20} scale={-1}>
        {article}
      </Paragraph>
    </Box>
  )
}

const EventDetails = waitForTimeline(
  ({
    slug,
    image,
    title,
    titleEn,
    start,
    end,
  }: Pick<TimelineEventProps, 'slug' | 'image' | 'title' | 'titleEn' | 'start' | 'end'>) => {
    const isFR = useLanguage()
    const { goBack, canGoBack } = useEventDetailsModal()
    const date = calculateLabel(start, end)
    const event = useMemo(() => {
      return (bibleMemoize.timeline as TimelineEventDetail[]).find(e => e.slug === slug)
    }, [slug])

    if (!event) {
      return null
    }

    return (
      <Box py={10}>
        {canGoBack && (
          <Link onPress={goBack}>
            <Box row alignItems="center" px={20} py={10}>
              <FeatherIcon name="arrow-left" size={20} />
              <Paragraph ml={10}>Retour</Paragraph>
            </Box>
          </Link>
        )}
        {image && (
          <Box center my={30}>
            <Image
              style={{ width: 150, height: 150, borderRadius: 10 }}
              source={{
                uri: image,
              }}
            />
          </Box>
        )}
        <Box mb={30} px={20}>
          <Paragraph textAlign="center" fontFamily="title" scale={3} flex>
            {isFR ? title : titleEn}
          </Paragraph>
          <Paragraph color="grey" scale={-2} textAlign="center" fontFamily="text">
            {date}
          </Paragraph>
        </Box>
        <Description {...event} />
        <Media {...event} />
      </Box>
    )
  }
)

export default EventDetails
