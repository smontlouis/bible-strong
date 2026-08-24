import React from 'react'
import styled from '@emotion/native'
import { Pressable } from 'react-native'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useTranslation } from 'react-i18next'
import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'

const SectionItem = styled(Box)(({ theme }) => ({
  height: 80,
  marginLeft: 20,
  marginRight: 20,
  backgroundColor: theme.colors.reverse,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  alignItems: 'flex-start',
  justifyContent: 'center',
}))

interface ChipProps {
  isHebreu?: boolean
}

const Chip = styled(Box)<ChipProps>(({ theme, isHebreu }) => ({
  borderRadius: 10,
  backgroundColor: isHebreu ? theme.colors.lightPrimary : theme.colors.border,
  paddingTop: 2,
  paddingBottom: 2,
  paddingLeft: 5,
  paddingRight: 5,
  marginBottom: 3,
}))

interface LexiqueItemProps extends StrongLexiconSearchResult {
  onSelect?: (book: number, reference: string, title?: string) => void
}

const LexiqueItem = ({ stepCode, language, original, gloss, onSelect }: LexiqueItemProps) => {
  const { t } = useTranslation()
  const book = language === 'hebrew' ? 1 : 40
  const lexiqueType = language === 'hebrew' ? 'Hébreu' : 'Grec'

  const handlePress = () => {
    onSelect?.(book, stepCode, gloss)
  }

  const content = (
    <SectionItem>
      <Box row>
        <Chip isHebreu={language === 'hebrew'}>
          <Text fontSize={10}>{t(lexiqueType)}</Text>
        </Chip>
        <Chip marginLeft={5}>
          <Text fontSize={10}>{stepCode}</Text>
        </Chip>
      </Box>
      <Box row>
        <Text title fontSize={18} color="default" flex paddingRight={20}>
          {gloss}
        </Text>
        <Text
          accessibilityLanguage={language === 'hebrew' ? 'he-IL' : 'el-GR'}
          fontSize={18}
          color="default"
        >
          {original}
        </Text>
      </Box>
    </SectionItem>
  )

  if (onSelect) {
    return (
      <Pressable accessibilityRole="button" onPress={handlePress}>
        {content}
      </Pressable>
    )
  }

  return (
    <Link route="Strong" params={{ book, reference: stepCode }}>
      {content}
    </Link>
  )
}

export default LexiqueItem
