import React from 'react'

import BottomSheet from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import { ActionMenuOption } from '~common/ActionMenu'
import Header from '~common/Header'
import LanguageMenuOption from '~common/LanguageMenuOption'
import PopOverMenu from '~common/PopOverMenu'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import ScrollView from '~common/ui/ScrollView'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useQuery } from '~helpers/react-query-lite'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import TimelineHomeDetailModal from './TimelineHomeDetailModal'
import TimelineItem from './TimelineItem'
import { getEvents } from './events'

interface Props {
  hasBackButton?: boolean
  isFormSheet?: boolean
  onSectionPress?: (sectionIndex: number) => void
}

const TimelineHomeScreen = ({ hasBackButton, isFormSheet = false, onSectionPress }: Props) => {
  const modalRef = React.useRef<BottomSheet>(null)
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = hasBackButton ?? (isFormSheet ? canGoBackInStack : true)

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
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        <Header
          hasBackButton={showBackButton}
          title={t('La Chronologie biblique')}
          rightComponent={
            <PopOverMenu
              popover={
                <>
                  <LanguageMenuOption resourceId="TIMELINE" />
                  <ActionMenuOption
                    icon="info"
                    label={t('Détails')}
                    onSelect={() => modalRef.current?.expand()}
                  />
                  <ActionMenuOption
                    icon="external-link"
                    label={t('tab.openInNewTab')}
                    onSelect={openTimelineInNewTab}
                  />
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
      </Box>
    </FormSheetScreen>
  )
}

export default TimelineHomeScreen
