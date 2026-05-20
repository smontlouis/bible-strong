import React from 'react'

import BottomSheet from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import LanguageMenuOption from '~common/LanguageMenuOption'
import PopOverMenu from '~common/PopOverMenu'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useQuery } from '~helpers/react-query-lite'
import TimelineHomeDetailModal from './TimelineHomeDetailModal'
import TimelineItem from './TimelineItem'
import { getEvents } from './events'

interface Props {
  hasBackButton?: boolean
  onSectionPress?: (sectionIndex: number) => void
}

const TimelineHomeScreen = ({ hasBackButton = true, onSectionPress }: Props) => {
  const modalRef = React.useRef<BottomSheet>(null)
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()

  const { data: events } = useQuery({
    queryKey: 'timeline',
    queryFn: getEvents,
  })

  const openTimelineInNewTab = () => {
    openInNewTab({
      id: `timeline-${generateUUID()}`,
      title: t('Chronologie de la Bible'),
      isRemovable: true,
      type: 'timeline',
      data: {},
    })
  }

  return (
    <Container>
      <Header
        hasBackButton={hasBackButton}
        title={t('La Chronologie biblique')}
        rightComponent={
          <PopOverMenu
            popover={
              <>
                <LanguageMenuOption resourceId="TIMELINE" />
                <MenuOption onSelect={() => modalRef.current?.expand()}>
                  <Box row alignItems="center">
                    <FeatherIcon name="info" size={15} />
                    <Text marginLeft={10}>{t('Détails')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption onSelect={openTimelineInNewTab}>
                  <Box row alignItems="center">
                    <FeatherIcon name="external-link" size={15} />
                    <Text marginLeft={10}>{t('tab.openInNewTab')}</Text>
                  </Box>
                </MenuOption>
              </>
            }
          />
        }
      />
      <ScrollView backgroundColor="lightGrey">
        {events?.map((event, i) => (
          <TimelineItem goTo={i} key={event.id} onPress={onSectionPress} {...event} />
        ))}
      </ScrollView>
      <TimelineHomeDetailModal modalRef={modalRef} />
    </Container>
  )
}

export default TimelineHomeScreen
