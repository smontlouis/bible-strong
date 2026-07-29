import React from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Text from '~common/ui/Text'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import { StrongEditorialHtml, StrongEyebrow } from './StrongDetailUI'
import StrongLexiconModuleCard from './StrongLexiconModuleCard'

type Props = {
  entry: StrongLexiconEntry
  availability: StrongLexiconModuleAvailability
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}

const StrongDictionaryPage = ({
  entry,
  availability,
  onOpenBibleReference,
  onOpenStrong,
}: Props) => {
  const { t } = useTranslation()
  const resource = entry.resources[0]
  if (!resource) {
    if (entry.language === 'greek' && availability.status !== 'available') {
      return (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 }}
        >
          <StrongLexiconModuleCard
            moduleId="resources"
            availability={availability}
            title={t('strongLexicon.greekDictionary')}
            description={t('strongLexicon.greekDictionaryDescription')}
          />
        </ScrollView>
      )
    }
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message={t('strongDetail.dictionary.unavailable')}
      />
    )
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 }}
    >
      <StrongEyebrow>{resource.source}</StrongEyebrow>
      <Text bold fontSize={22} mt={6} mb={14}>
        {resource.title}
      </Text>
      <StrongEditorialHtml
        value={resource.contentHtml}
        onOpenBibleReference={onOpenBibleReference}
        onOpenStrong={onOpenStrong}
      />
    </ScrollView>
  )
}

export default StrongDictionaryPage
