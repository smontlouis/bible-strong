import { useTheme } from '@emotion/react'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSharedValue } from 'react-native-reanimated'

import { VerseIds, VerseRefContent } from '~common/types'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import AccordionItem from '~features/bible/BookSelectorBottomSheet/AccordionItem'
import getVersesContent from '~helpers/getVersesContent'
import verseToReference from '~helpers/verseToReference'
import { VersionCode } from '~state/tabs'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'

interface VerseAccordionProps {
  noteVerses: VerseIds
  version?: VersionCode
}

const VerseAccordion = ({ noteVerses, version }: VerseAccordionProps) => {
  const theme = useTheme()
  const defaultVersion = useDefaultBibleVersion()
  const [isExpanded, setIsExpanded] = useState(false)
  const [verseContent, setVerseContent] = useState<VerseRefContent | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Bridge React state to SharedValue for AccordionItem
  const isExpandedShared = useSharedValue(false)

  useEffect(() => {
    isExpandedShared.set(isExpanded)
  }, [isExpanded, isExpandedShared])

  // Fetch verse content on mount or when verses change
  useEffect(() => {
    const loadVerseContent = async () => {
      setIsLoading(true)
      const _version = version || defaultVersion
      try {
        const content = await getVersesContent({
          verses: noteVerses,
          version: _version,
          hasVerseNumbers: Object.keys(noteVerses).length > 1,
        })
        setVerseContent(content)
        setIsLoading(false)
      } catch (e) {
        console.error('[VerseAccordion] Failed to load verse:', e)
        setIsLoading(false)
      }
    }
    loadVerseContent()
  }, [noteVerses, version, defaultVersion])

  const reference = verseToReference(noteVerses)

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
        <Animated.View
          // @ts-ignore - CSS Transitions for Reanimated 4
          style={{
            transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
            transitionProperty: 'transform',
            transitionDuration: 300,
          }}
        >
          <FeatherIcon name="chevron-down" size={20} color={theme.colors.grey} />
        </Animated.View>
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
              Impossible de charger le verset.
            </Text>
          )}
        </Box>
      </AccordionItem>
    </Box>
  )
}

export default VerseAccordion
