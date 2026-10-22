import { pageContentStyle } from '~common/ui/PageContent'
import React from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import { usePageBottomInset } from '~common/ui/Box'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import {
  STRONG_COLUMN_MAX_WIDTH,
  StrongEditorialHtml,
  StrongEditorialSection,
} from './StrongDetailUI'
type Props = {
  entry: StrongLexiconEntry
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}

const StrongDictionaryPage = ({ entry, onOpenBibleReference, onOpenStrong }: Props) => {
  const { t } = useTranslation()
  const bottomInset = usePageBottomInset()
  const resource = entry.resources[0]
  if (!resource) {
    return <Empty message={t('strongDetail.dictionary.unavailable')} />
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        pageContentStyle,
        {
          maxWidth: STRONG_COLUMN_MAX_WIDTH + 40,
          paddingHorizontal: 20,
          paddingTop: 22,
          paddingBottom: 90 + bottomInset,
        },
      ]}
    >
      <StrongEditorialSection title={resource.source} className="mt-[0px]">
        <StrongEditorialHtml
          selectable
          value={resource.contentHtml}
          onOpenBibleReference={onOpenBibleReference}
          onOpenStrong={onOpenStrong}
        />
      </StrongEditorialSection>
    </ScrollView>
  )
}

export default StrongDictionaryPage
