import React from 'react'

import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import PopOverMenu from '~common/PopOverMenu'
import ModalHeader from '~common/ModalHeader'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import generateUUID from '~helpers/generateUUID'
import EventDetails from './EventDetails'
import { TimelineEvent as TimelineEventProps } from './types'
import { useTranslation } from 'react-i18next'
import { useEventDetailsModal } from './EventDetailsModalContext'

interface Props {
  modalRef: React.RefObject<BottomSheet | null>
  scrollViewRef: React.RefObject<BottomSheetScrollViewMethods | null>
  event: Partial<TimelineEventProps> | null
}

type EventDetailsProps = Pick<
  TimelineEventProps,
  'slug' | 'image' | 'title' | 'titleEn' | 'start' | 'end'
> & { sectionIndex?: number }

const hasEventDetails = (event: Partial<TimelineEventProps> | null): event is EventDetailsProps =>
  Boolean(event?.slug && event.title && event.titleEn) &&
  event?.start !== undefined &&
  event.end !== undefined

const EventDetailsModal = ({ modalRef, scrollViewRef, event }: Props) => {
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()
  const { canGoBack, goBack } = useEventDetailsModal()
  const canOpenEvent = hasEventDetails(event)

  const openEventInNewTab = () => {
    if (!canOpenEvent) return

    openInNewTab({
      id: `timeline-${generateUUID()}`,
      title: event.title,
      isRemovable: true,
      type: 'timeline',
      data: {
        sectionIndex: event.sectionIndex,
        eventSlug: event.slug,
        event: {
          slug: event.slug,
          title: event.title,
          titleEn: event.titleEn,
          image: event.image,
          start: event.start,
          end: event.end,
          sectionIndex: event.sectionIndex,
        },
      },
    })
  }

  return (
    <BottomSheet
      ref={modalRef}
      index={-1}
      enablePanDownToClose
      snapPoints={['100%']}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      topInset={useSafeAreaInsets().top + 56}
      key={key}
      {...bottomSheetStyles}
    >
      {canOpenEvent && (
        <ModalHeader
          title={event.title}
          hasBackButton={canGoBack}
          onBackPress={goBack}
          rightComponent={
            <PopOverMenu
              popover={
                <MenuOption onSelect={openEventInNewTab}>
                  <Box row alignItems="center">
                    <FeatherIcon name="external-link" size={15} />
                    <Text marginLeft={10}>{t('tab.openInNewTab')}</Text>
                  </Box>
                </MenuOption>
              }
            />
          }
        />
      )}
      <BottomSheetScrollView ref={scrollViewRef}>
        {canOpenEvent && (
          <EventDetails
            slug={event.slug}
            image={event.image}
            title={event.title}
            titleEn={event.titleEn}
            start={event.start}
            end={event.end}
          />
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

export default EventDetailsModal
