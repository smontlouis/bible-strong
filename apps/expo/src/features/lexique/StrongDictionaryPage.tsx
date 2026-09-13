import { pageContentStyle } from '~common/ui/PageContent'
import React from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import { VStack } from '~common/ui/Box'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import { StrongEditorialHtml, StrongEyebrow } from './StrongDetailUI'
type Props = {
  entry: StrongLexiconEntry
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}

const StrongDictionaryPage = ({ entry, onOpenBibleReference, onOpenStrong }: Props) => {
  const { t } = useTranslation()
  const resource = entry.resources[0]
  if (!resource) {
    return <Empty message={t('strongDetail.dictionary.unavailable')} />
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        pageContentStyle,
        { maxWidth: 600, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 },
      ]}
    >
      <VStack className="overflow-hidden border-continuous gap-[14px]">
        <StrongEyebrow>{resource.source}</StrongEyebrow>
        <StrongEditorialHtml
          value={resource.contentHtml}
          onOpenBibleReference={onOpenBibleReference}
          onOpenStrong={onOpenStrong}
        />
      </VStack>
    </ScrollView>
  )
}

export default StrongDictionaryPage
