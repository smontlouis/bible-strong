import { pageContentStyle } from '~common/ui/PageContent'
import React from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import { StrongEditorialSection, StrongEyebrow, StrongLexicalRelationCard } from './StrongDetailUI'
import { splitStrongLexicalRelations } from './strongLexiconRelations'
import type { StrongReadingTypography } from './strongEditorialHtmlStyles'
type Props = {
  entry: StrongLexiconEntry
  readingTypography: StrongReadingTypography
  onOpenStrong: (stepCode: string) => void
}

const StrongRelatedPage = ({ entry, readingTypography, onOpenStrong }: Props) => {
  const { t } = useTranslation()
  const { relatedWords } = splitStrongLexicalRelations(entry.relations)
  const groups = [
    { id: 'identity' as const, title: t('strongLexicon.variants') },
    { id: 'family' as const, title: t('strongLexicon.wordFamily') },
  ]

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        pageContentStyle,
        { maxWidth: 600, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 },
      ]}
    >
      <StrongEyebrow>
        {entry.original} · {entry.gloss}
      </StrongEyebrow>
      <Text className="text-tertiary text-[12px] mt-[5px]">{entry.stepCode}</Text>
      {groups.map(group => {
        const relations = relatedWords.filter(relation => relation.group === group.id)
        if (!relations.length) return null
        return (
          <StrongEditorialSection key={group.id} title={group.title}>
            <VStack className="overflow-hidden border-continuous gap-[9px]">
              {relations.map(relation => (
                <StrongLexicalRelationCard
                  key={`${relation.stepCode}:${relation.label}`}
                  relation={relation}
                  readingTypography={readingTypography}
                  onPress={() => onOpenStrong(relation.stepCode)}
                />
              ))}
            </VStack>
          </StrongEditorialSection>
        )
      })}
    </ScrollView>
  )
}

export default StrongRelatedPage
