import React from 'react'
import { useTranslation } from 'react-i18next'

import { ActionMenuContent } from '~common/ActionMenu'
import Empty from '~common/Empty'
import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import MenuOption from '~common/ui/MenuOption'
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
    icon: React.ComponentProps<typeof ActionMenuContent>['icon']
    onSelect: () => void
  }[]
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
              <PopOverMenu
                popover={
                  <>
                    {menuItems.map(item => (
                      <MenuOption key={item.label} onSelect={item.onSelect}>
                        <ActionMenuContent icon={item.icon} label={item.label} />
                      </MenuOption>
                    ))}
                  </>
                }
              />
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
