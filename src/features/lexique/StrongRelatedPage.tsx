import React from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'

import { VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import { StrongEditorialSection, StrongEyebrow, StrongLexicalRelationCard } from './StrongDetailUI'

type Props = {
  entry: StrongLexiconEntry
  onOpenStrong: (stepCode: string) => void
}

const StrongRelatedPage = ({ entry, onOpenStrong }: Props) => {
  const { t } = useTranslation()
  const groups = [
    { id: 'subentry' as const, title: t('strongLexicon.otherMeanings') },
    { id: 'identity' as const, title: t('strongLexicon.variants') },
    { id: 'family' as const, title: t('strongLexicon.wordFamily') },
  ]

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 }}
    >
      <StrongEyebrow>
        {entry.original} · {entry.gloss}
      </StrongEyebrow>
      <Text color="tertiary" fontSize={12} mt={5}>
        {entry.stepCode}
      </Text>
      {groups.map(group => {
        const relations = entry.relations.filter(relation => relation.group === group.id)
        if (!relations.length) return null
        return (
          <StrongEditorialSection key={group.id} title={group.title}>
            <VStack gap={9}>
              {relations.map(relation => (
                <StrongLexicalRelationCard
                  key={`${relation.stepCode}:${relation.label}`}
                  relation={relation}
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
