import React from 'react'

import BottomSheet from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Link from '~common/Link'
import PopOverMenu from '~common/PopOverMenu'
import LanguageMenuOption from '~common/LanguageMenuOption'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import ScrollView from '~common/ui/ScrollView'
import { useQuery } from '~helpers/react-query-lite'
import TimelineHomeDetailModal from './TimelineHomeDetailModal'
import TimelineItem from './TimelineItem'
import { getEvents } from './events'

const TimelineHomeScreen = () => {
  const modalRef = React.useRef<BottomSheet>(null)
  const { t } = useTranslation()

  const { data: events } = useQuery({
    queryKey: 'timeline',
    queryFn: getEvents,
  })

  return (
    <Container>
      <Header
        hasBackButton
        title={t('La Chronologie biblique')}
        rightComponent={
          <Box row alignItems="center">
            <Link paddingSmall onPress={() => modalRef.current?.expand()}>
              <FeatherIcon name="info" size={20} />
            </Link>
            <PopOverMenu
              popover={
                <>
                  <LanguageMenuOption resourceId="TIMELINE" />
                </>
              }
            />
          </Box>
        }
      />
      <ScrollView backgroundColor="lightGrey">
        {events?.map((event, i) => (
          <TimelineItem goTo={i} key={event.id} {...event} />
        ))}
      </ScrollView>
      <TimelineHomeDetailModal modalRef={modalRef} />
    </Container>
  )
}

export default TimelineHomeScreen
