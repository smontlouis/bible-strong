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
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import {
  getOfflineResourceQuerySignal,
  useOfflineResourceRegistry,
} from '~features/resources/useOfflineResourceRegistry'
export type EventDetailsProps = Pick<
  TimelineEventProps,
  'slug' | 'image' | 'title' | 'titleEn' | 'start' | 'end'
>

const Description = ({ description, article }: Partial<TimelineEventDetail>) => {
  return (
    <Box className="overflow-hidden border-continuous px-[20px]">
      <Paragraph className="mb-[10px]" fontFamily="title">
        Description
      </Paragraph>
      <Paragraph className="font-bold" scale={-1}>
        {description}
      </Paragraph>
      <Paragraph className="mt-[20px]" scale={-1}>
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
  const resourceRegistry = useOfflineResourceRegistry()
  const eventQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.timeline(resourceLanguage),
      'event',
      slug,
      getOfflineResourceQuerySignal(resourceRegistry, {
        kind: 'database',
        databaseId: 'TIMELINE',
        language: resourceLanguage,
      }),
    ],
    queryFn: () => resources.timeline.loadEvent(resourceLanguage, slug),
    networkMode: 'always',
  })
  const event = eventQuery.data?.status === 'available' ? eventQuery.data.detail : undefined

  if (eventQuery.isPending) {
    return (
      <Box className="overflow-hidden border-continuous py-[40px] items-center justify-center">
        <Loading />
      </Box>
    )
  }

  if (!event) {
    return null
  }

  return (
    <Box className="overflow-hidden border-continuous py-[10px]">
      {image && (
        <Box className="overflow-hidden border-continuous items-center justify-center my-[30px]">
          <Image
            style={{ width: 150, height: 150, borderRadius: 10 }}
            source={{
              uri: image,
            }}
          />
        </Box>
      )}
      <Box className="overflow-hidden border-continuous mb-[30px] px-[20px]">
        <Paragraph className="text-center flex-[1]" fontFamily="title" scale={3}>
          {getLegacyLocalizedField(lang, { fr: title, en: titleEn })}
        </Paragraph>
        <Paragraph className="text-grey text-center" scale={-2} fontFamily="text">
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
