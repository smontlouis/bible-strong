import React from 'react'

import TimelineItem from './TimelineItem'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import ScrollView from '~common/ui/ScrollView'
import Link from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import { Modalize } from 'react-native-modalize'
import TimelineHomeDetailModal from './TimelineHomeDetailModal'
import { useTranslation } from 'react-i18next'
import { useQuery } from '~helpers/react-query-lite'
import { getEvents } from './events'

const TimelineHomeScreen = () => {
  const modalRef = React.useRef<Modalize>(null)
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
          <Link paddingSmall onPress={() => modalRef.current?.open()}>
            <FeatherIcon name="info" size={20} />
          </Link>
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
