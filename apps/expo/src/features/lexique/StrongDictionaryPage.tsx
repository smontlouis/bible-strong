import React from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import { VStack } from '~common/ui/Box'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import { StrongEditorialHtml, StrongEyebrow } from './StrongDetailUI'
import type { StrongReadingTypography } from './strongEditorialHtmlStyles'

type Props = {
  entry: StrongLexiconEntry
  readingTypography: StrongReadingTypography
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}

const StrongDictionaryPage = ({
  entry,
  readingTypography,
  onOpenBibleReference,
  onOpenStrong,
}: Props) => {
  const { t } = useTranslation()
  const resource = entry.resources[0]
  if (!resource) {
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
      <VStack gap={14}>
        <StrongEyebrow>{resource.source}</StrongEyebrow>
        <StrongEditorialHtml
          value={resource.contentHtml}
          readingTypography={readingTypography}
          onOpenBibleReference={onOpenBibleReference}
          onOpenStrong={onOpenStrong}
        />
      </VStack>
    </ScrollView>
  )
}

export default StrongDictionaryPage
