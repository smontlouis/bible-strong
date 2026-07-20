import { useTheme } from '@emotion/react'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { EaseView } from 'react-native-ease'
import { useSharedValue } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'

import { VerseIds } from '~common/types'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import AccordionItem from '~features/bible/BookSelectorSheet/AccordionItem'
import { useResolvedBibleVerses, verseStringToObject } from '~helpers/useBibleVerses'
import verseToReference from '~helpers/verseToReference'

interface VerseAccordionProps {
  noteVerses: VerseIds
  version?: string
}

const VerseAccordion = ({ noteVerses, version }: VerseAccordionProps) => {
  const hasVerses = Object.keys(noteVerses).length > 0
  const theme = useTheme()
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const verseKeys = Object.keys(noteVerses)
  const { verses, isLoading } = useResolvedBibleVerses(verseStringToObject(verseKeys), version)
  const verseContent = verses.length
    ? {
        content: verses
          .map(verse => `${verses.length > 1 ? `${verse.Verset}. ` : ''}${verse.Texte}`)
          .join(' '),
      }
    : null

  // Bridge React state to SharedValue for AccordionItem
  const isExpandedShared = useSharedValue(false)

  useEffect(() => {
    isExpandedShared.set(isExpanded)
  }, [isExpanded, isExpandedShared])

  const reference = verseToReference(noteVerses)

  if (!hasVerses) return null

  const toggleExpand = () => {
    setIsExpanded(prev => !prev)
  }

  return (
    <Box bg="opacity5" borderRadius={14} overflow="hidden">
      <TouchableBox row alignItems="center" py={12} px={16} onPress={toggleExpand}>
        <HStack flex alignItems="center" gap={8}>
          <FeatherIcon name="book-open" size={16} color={theme.colors.primary} />
          <Text fontSize={14} color="primary" bold>
            {reference}
          </Text>
        </HStack>
        <EaseView
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{
            type: 'timing',
            duration: 300,
            easing: [0.455, 0.03, 0.515, 0.955],
          }}
          style={{
            width: 20,
            height: 20,
          }}
        >
          <FeatherIcon name="chevron-down" size={20} color={theme.colors.grey} />
        </EaseView>
      </TouchableBox>

      <AccordionItem isExpanded={isExpandedShared} viewKey="verse-content">
        <Box px={16}>
          {isLoading ? (
            <Box center py={10}>
              <ActivityIndicator color={theme.colors.grey} />
            </Box>
          ) : verseContent ? (
            <Paragraph scale={-2} scaleLineHeight={-1}>
              {verseContent.content}
            </Paragraph>
          ) : (
            <Text fontSize={12} color="grey">
              {t('bibleVerse.textUnavailableInstalled')}
            </Text>
          )}
        </Box>
      </AccordionItem>
    </Box>
  )
}

export default VerseAccordion
