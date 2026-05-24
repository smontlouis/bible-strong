import React from 'react'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
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
}

const TimelineEventDetailPage = waitForTimeline(
  ({ event, onOpenEvent, canGoBack, onBack }: Props) => {
    const { t } = useTranslation()
    const lang = useLanguage()

    if (!event) {
      return (
        <Container>
          <Header title={t('Chronologie de la Bible')} />
          <Empty
            icon={require('~assets/images/empty-state-icons/search.svg')}
            message={t("Cet événement n'est plus disponible.")}
          />
        </Container>
      )
    }

    return (
      <Container>
        <Header
          title={getLegacyLocalizedField(lang, { fr: event.title, en: event.titleEn })}
          hasBackButton={canGoBack}
          onCustomBackPress={onBack}
        />
        <ScrollView>
          <EventDetailsContent {...event} onOpenEvent={onOpenEvent} />
        </ScrollView>
      </Container>
    )
  }
)

export default TimelineEventDetailPage
