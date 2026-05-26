import React from 'react'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Box from '~common/ui/Box'
import MenuOption from '~common/ui/MenuOption'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import waitForTimeline from '~common/waitForTimeline'
import useLanguage from '~helpers/useLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
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
    icon: React.ReactNode
    onSelect: () => void
  }[]
}

const TimelineEventDetailView = waitForTimeline(
  ({ event, onOpenEvent, canGoBack, onBack, isFormSheet = false, menuItems }: Props) => {
    const { t } = useTranslation()
    const lang = useLanguage()

    if (!event) {
      return (
        <FormSheetScreen isFormSheet={isFormSheet}>
          <Header title={t('Chronologie de la Bible')} />
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
          hasBackButton={!isFormSheet && canGoBack}
          onCustomBackPress={onBack}
          rightComponent={
            menuItems?.length ? (
              <PopOverMenu
                popover={
                  <>
                    {menuItems.map(item => (
                      <MenuOption key={item.label} onSelect={item.onSelect}>
                        <Box row alignItems="center">
                          {item.icon}
                          <Text marginLeft={10}>{item.label}</Text>
                        </Box>
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
