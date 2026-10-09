import React from 'react'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import ScrollView from '~common/ui/ScrollView'
import useTimelineLanguage from './useTimelineLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import { getPublicSiteUrl } from '~helpers/publicSiteLinks'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  resourceShareMenuActions,
  runResourceShareAction,
  type ResourceShare,
} from '~features/share/resourceShare'
import { buildPublicTimelineEventPath } from './publicTimelineRoutes'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { EventDetailsContent, EventDetailsProps } from './EventDetails'
import { TimelineEvent } from './types'
interface Props {
  languageOverride?: 'fr' | 'en'
  assistantScope?: string
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

const TimelineEventDetailContent = ({
  languageOverride,
  assistantScope,
  event,
  onOpenEvent,
  canGoBack,
  onBack,
  isFormSheet = false,
  menuItems,
}: Props) => {
  const { t } = useTranslation()
  const preferredLanguage = useTimelineLanguage()
  const lang = languageOverride || preferredLanguage
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : canGoBack
  const resources = useResourceAccess()

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

  const title = getLegacyLocalizedField(lang, { fr: event.title, en: event.titleEn })
  const share: ResourceShare = {
    url: getPublicSiteUrl(() => buildPublicTimelineEventPath({ language: lang, slug: event.slug })),
    title,
    // The article is read where the event is read from; without it the title is what is left.
    text: async () => {
      const result = await resources.timeline.loadEvent(lang, event.slug)
      if (result.status !== 'available') return title
      const { detail } = result
      return [detail.title, detail.dates, detail.description, detail.article]
        .filter(Boolean)
        .join('\n\n')
    },
  }
  const menuActions: MenuAction[] = [
    ...resourceShareMenuActions(t, share),
    ...(menuItems ?? []).map(item => ({
      id: item.label,
      title: item.label,
      image: getMenuItemImage(item.icon),
    })),
  ]

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        title={title}
        hasBackButton={hasBackButton}
        onCustomBackPress={onBack}
        rightComponent={
          <MenuView
            tabActions
            actions={menuActions}
            onPressAction={({ nativeEvent }) => {
              if (runResourceShareAction(nativeEvent.event, share)) return
              menuItems?.find(item => item.label === nativeEvent.event)?.onSelect()
            }}
          >
            <Box className="overflow-hidden border-continuous flex-row items-center justify-center h-[54px] w-[54px]">
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          </MenuView>
        }
      />
      <ScrollView>
        <EventDetailsContent
          languageOverride={languageOverride}
          assistantScope={assistantScope}
          {...event}
          onOpenEvent={onOpenEvent}
        />
      </ScrollView>
    </FormSheetScreen>
  )
}

const TimelineEventDetailView = (props: Props) => <TimelineEventDetailContent {...props} />

export default TimelineEventDetailView
