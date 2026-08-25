import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import useLanguage from '~helpers/useLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'

import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import { calculateLabel } from './constants'
import { TimelineEventDetail, TimelineEvent as TimelineEventProps } from './types'
import { Image } from 'expo-image'
import Media from './EventDetailsMedia'
import Loading from '~common/Loading'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'

export type EventDetailsProps = Pick<
  TimelineEventProps,
  'slug' | 'image' | 'title' | 'titleEn' | 'start' | 'end'
>

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

export const EventDetailsContent = ({
  slug,
  image,
  title,
  titleEn,
  start,
  end,
  onOpenEvent,
}: EventDetailsProps & {
  onOpenEvent?: (event: TimelineEventProps) => void
}) => {
  const lang = useLanguage()
  const date = calculateLabel(start, end)
  const resources = useResourceAccess()
  const resourceLanguage = useAtomValue(resourcesLanguageAtom).TIMELINE
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const eventQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.timeline(resourceLanguage),
      'event',
      slug,
      downloadCompletionSignal,
    ],
    queryFn: () => resources.timeline.loadEvent(resourceLanguage, slug),
    networkMode: 'always',
  })
  const event = eventQuery.data?.status === 'available' ? eventQuery.data.detail : undefined

  if (eventQuery.isPending) {
    return (
      <Box py={40} center>
        <Loading />
      </Box>
    )
  }

  if (!event) {
    return null
  }

  return (
    <Box py={10}>
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
          {getLegacyLocalizedField(lang, { fr: title, en: titleEn })}
        </Paragraph>
        <Paragraph color="grey" scale={-2} textAlign="center" fontFamily="text">
          {date}
        </Paragraph>
      </Box>
      <Description {...event} />
      <Media {...event} onOpenEvent={onOpenEvent} />
    </Box>
  )
}

const EventDetails = (props: EventDetailsProps) => <EventDetailsContent {...props} />

export default EventDetails
