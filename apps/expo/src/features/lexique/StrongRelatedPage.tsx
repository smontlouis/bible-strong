import { pageContentStyle } from '~common/ui/PageContent'
import React from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { VStack, usePageBottomInset } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { formatStrongDisplayCode } from '~helpers/strongIdentities'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import { StrongLexicalRelationRow } from './StrongDetailUI'
import { STUDY_COLUMN_MAX_WIDTH, StudySection } from '~common/ui/StudySection'
import { splitStrongLexicalRelations } from './strongLexiconRelations'
import { getScaledStrongTextStyle, type StrongReadingTypography } from './strongEditorialHtmlStyles'
import { isStrongOriginalUnnamed } from './strongOriginalPresentation'
type Props = {
  entry: StrongLexiconEntry
  readingTypography: StrongReadingTypography
  onOpenStrong: (stepCode: string) => void
}

const StrongRelatedPage = ({ entry, readingTypography, onOpenStrong }: Props) => {
  const { t } = useTranslation()
  const bottomInset = usePageBottomInset()
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
        {
          maxWidth: STUDY_COLUMN_MAX_WIDTH + 40,
          paddingHorizontal: 20,
          paddingTop: 22,
          paddingBottom: 90 + bottomInset,
        },
      ]}
    >
      <VStack className="gap-[2px] px-[4px]">
        {!isStrongOriginalUnnamed(entry.original) && (
          <Text style={getScaledStrongTextStyle(26, 34, readingTypography)}>{entry.original}</Text>
        )}
        <Text className="text-[15px] text-grey">
          {entry.gloss} · {formatStrongDisplayCode(entry.stepCode)}
        </Text>
      </VStack>
      {groups.map(group => {
        const relations = relatedWords.filter(relation => relation.group === group.id)
        if (!relations.length) return null
        return (
          <StudySection key={group.id} title={group.title} surface="rows">
            {relations.map(relation => (
              <StrongLexicalRelationRow
                key={`${relation.stepCode}:${relation.label}`}
                relation={relation}
                readingTypography={readingTypography}
                onPress={() => onOpenStrong(relation.stepCode)}
              />
            ))}
          </StudySection>
        )
      })}
    </ScrollView>
  )
}

export default StrongRelatedPage
