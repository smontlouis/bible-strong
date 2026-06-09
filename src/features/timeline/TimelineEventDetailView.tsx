import React from 'react'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import ScrollView from '~common/ui/ScrollView'
import waitForTimeline from '~common/waitForTimeline'
import useLanguage from '~helpers/useLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { EventDetailsContent, EventDetailsProps } from './EventDetails'
import { TimelineEvent } from './types'

interface Props {
  event?: TimelineEvent | (EventDetailsProps & { sectionIndex?: number })
  onOpenEvent: (event: TimelineEvent) => void
  canGoBack?: boolean
  onBack?: () => void
  isFormSheet?: boolean
  menuItems?: {
    label: string
    icon: string
    onSelect: () => void
  }[]
}

const getMenuItemImage = (icon: string): MenuAction['image'] => {
  switch (icon) {
    case 'external-link':
      return 'arrow.up.forward.square'
    default:
      return undefined
  }
}

const TimelineEventDetailView = waitForTimeline(
  ({ event, onOpenEvent, canGoBack, onBack, isFormSheet = false, menuItems }: Props) => {
    const { t } = useTranslation()
    const lang = useLanguage()
    const canGoBackInStack = useCanGoBackInStack()
    const hasBackButton = isFormSheet ? canGoBackInStack : canGoBack

    if (!event) {
      return (
        <FormSheetScreen isFormSheet={isFormSheet}>
          <Header title={t('Chronologie de la Bible')} hasBackButton={hasBackButton} />
          <Empty
            icon={require('~assets/images/empty-state-icons/search.svg')}
            message={t("Cet événement n'est plus disponible.")}
          />
        </FormSheetScreen>
      )
    }

    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header
          title={getLegacyLocalizedField(lang, { fr: event.title, en: event.titleEn })}
          hasBackButton={hasBackButton}
          onCustomBackPress={onBack}
          rightComponent={
            menuItems?.length ? (
              <MenuView
                actions={menuItems.map(item => ({
                  id: item.label,
                  title: item.label,
                  image: getMenuItemImage(item.icon),
                }))}
                onPressAction={({ nativeEvent }) => {
                  menuItems.find(item => item.label === nativeEvent.event)?.onSelect()
                }}
              >
                <Box row center height={60} width={60}>
                  <FeatherIcon name="more-vertical" size={18} />
                </Box>
              </MenuView>
            ) : undefined
          }
        />
        <ScrollView>
          <EventDetailsContent {...event} onOpenEvent={onOpenEvent} />
        </ScrollView>
      </FormSheetScreen>
    )
  }
)

export default TimelineEventDetailView
