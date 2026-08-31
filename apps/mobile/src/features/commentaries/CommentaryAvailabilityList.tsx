import React from 'react'
import { useTranslation } from 'react-i18next'
import { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated'

import { LinkBox } from '~common/Link'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import CommentaryAvatar from './CommentaryAvatar'
import {
  formatCommentaryPassageLabel,
  type CommentaryVerseAvailability,
  type CommentaryVerseAvailabilityState,
} from './commentaryVerseAvailability'

const STATUS_COLORS: Record<CommentaryVerseAvailabilityState, string> = {
  verse: '#18A999',
  chapter: '#F4A340',
  'no-content': '#AEB4BE',
  unavailable: '#E05252',
}

type Props = {
  items: readonly CommentaryVerseAvailability[]
  headerTitle: string
  onManage: () => void
  onOpen: (item: CommentaryVerseAvailability) => void
}

const CommentaryAvailabilityList = ({ items, headerTitle, onManage, onOpen }: Props) => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  return (
    <AnimatedBox layout={reduceMotion ? undefined : LinearTransition.duration(220)} pt={12}>
      <Box row justifyContent="flex-end" px={20}>
        <LinkBox onPress={onManage} minHeight={44} center px={6}>
          <Text color="primary" fontSize={14} bold>
            {t('commentaries.availability.manage')}
          </Text>
        </LinkBox>
      </Box>

      {items.map(item => {
        const hasError = item.state === 'unavailable'
        const preview = item.comment?.content
          ? item.comment.content
          : item.state === 'chapter'
            ? t('commentaries.availability.chapterPreview')
            : item.state === 'unavailable'
              ? t('commentaries.availability.errorPreview')
              : t('commentaries.availability.noContentPreview')

        return (
          <TouchableBox
            key={item.projectionId}
            onPress={() => onOpen(item)}
            disabled={hasError}
            activeOpacity={0.62}
            accessibilityRole="button"
            accessibilityState={{ disabled: hasError }}
          >
            <AnimatedBox
              layout={reduceMotion ? undefined : LinearTransition.duration(200)}
              mx={20}
              mb={12}
              px={14}
              py={13}
              minHeight={94}
              rounded
              bg="reverse"
              lightShadow
              row
              alignItems="center"
            >
              <Box position="relative">
                <Box opacity={hasError ? 0.48 : 1}>
                  <CommentaryAvatar
                    resourceCode={item.resourceCode}
                    author={item.entry.author}
                    fallback={item.entry.shortName}
                    size={46}
                  />
                </Box>
                <Box
                  position="absolute"
                  right={-1}
                  bottom={-1}
                  size={13}
                  borderRadius={7}
                  backgroundColor={STATUS_COLORS[item.state]}
                  borderWidth={2}
                  borderColor="reverse"
                />
              </Box>

              <Box ml={12} flex opacity={hasError ? 0.52 : 1}>
                <Text bold fontSize={16} numberOfLines={1}>
                  {item.entry.shortName}
                </Text>
                <AnimatedBox
                  key={`${item.state}:${item.comment?.id ?? 'empty'}`}
                  entering={reduceMotion ? undefined : FadeIn.duration(150)}
                  exiting={reduceMotion ? undefined : FadeOut.duration(100)}
                >
                  <Text mt={3} color="grey" fontSize={13} numberOfLines={1} ellipsizeMode="tail">
                    {preview}
                  </Text>
                  {item.comment ? (
                    <Text mt={5} color="primary" fontSize={11} numberOfLines={1}>
                      {formatCommentaryPassageLabel(headerTitle, item.comment)}
                    </Text>
                  ) : null}
                </AnimatedBox>
              </Box>
            </AnimatedBox>
          </TouchableBox>
        )
      })}
    </AnimatedBox>
  )
}

export default CommentaryAvailabilityList
