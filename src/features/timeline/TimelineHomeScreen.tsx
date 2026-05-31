import React from 'react'
import { MenuView } from '@expo/ui/community/menu'

import BottomSheet, { type BottomSheet as BottomSheetRef } from '~common/bottom-sheet'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import ScrollView from '~common/ui/ScrollView'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useQuery } from '~helpers/react-query-lite'
import { toast } from '~helpers/toast'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResourceLanguage } from 'src/state/resourcesLanguage'
import TimelineHomeDetailModal from './TimelineHomeDetailModal'
import TimelineItem from './TimelineItem'
import { getEvents } from './events'

interface Props {
  hasBackButton?: boolean
  isFormSheet?: boolean
  onSectionPress?: (sectionIndex: number) => void
}

const TimelineHomeScreen = ({ hasBackButton, isFormSheet = false, onSectionPress }: Props) => {
  const modalRef = React.useRef<BottomSheetRef>(null)
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = hasBackButton ?? (isFormSheet ? canGoBackInStack : true)
  const [timelineResourceLanguage, setTimelineResourceLanguage] = useResourceLanguage('TIMELINE')

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

  const toggleTimelineLanguage = () => {
    const nextLanguage = timelineResourceLanguage === 'fr' ? 'en' : 'fr'
    setTimelineResourceLanguage(nextLanguage)
    toast(t('menu.languageChanged', { language: nextLanguage === 'fr' ? 'Français' : 'English' }))
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        <Header
          hasBackButton={showBackButton}
          title={t('La Chronologie biblique')}
          rightComponent={
            <MenuView
              actions={[
                {
                  id: 'language',
                  title: `${t('menu.language')}: ${
                    timelineResourceLanguage === 'fr' ? 'Français' : 'English'
                  }`,
                  image: 'globe',
                },
                { id: 'details', title: t('Détails'), image: 'info.circle' },
                {
                  id: 'open-tab',
                  title: t('tab.openInNewTab'),
                  image: 'arrow.up.forward.square',
                },
              ]}
              onPressAction={({ nativeEvent }) => {
                switch (nativeEvent.event) {
                  case 'language':
                    toggleTimelineLanguage()
                    break
                  case 'details':
                    modalRef.current?.expand()
                    break
                  case 'open-tab':
                    openTimelineInNewTab()
                    break
                }
              }}
            >
              <Box row center height={60} width={60}>
                <FeatherIcon name="more-vertical" size={18} />
              </Box>
            </MenuView>
          }
        />
        <ScrollView backgroundColor="lightGrey">
          {events?.map((event, i) => (
            <TimelineItem goTo={i} key={event.id} onPress={onSectionPress} {...event} />
          ))}
        </ScrollView>
        <TimelineHomeDetailModal modalRef={modalRef} />
      </Box>
    </FormSheetScreen>
  )
}

export default TimelineHomeScreen
