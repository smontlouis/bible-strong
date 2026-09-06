import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  return (
    <AnimatedBox
      className="overflow-hidden border-continuous pt-[12px]"
      layout={reduceMotion ? undefined : LinearTransition.duration(220)}
    >
      <Box className="overflow-hidden border-continuous flex-row justify-end px-[20px]">
        <LinkBox className="px-[6px] min-h-[44px] items-center justify-center" onPress={onManage}>
          <Text className="text-primary text-[14px] font-bold">
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
            className="overflow-hidden border-continuous"
            key={item.projectionId}
            onPress={() => onOpen(item)}
            disabled={hasError}
            activeOpacity={0.62}
            accessibilityRole="button"
            accessibilityState={{ disabled: hasError }}
            style={[{ opacity: hasError ? 0.6 : 1 }, [{ opacity: hasError ? 0.6 : 1 }]]}
          >
            <AnimatedBox
              className="overflow-hidden border-continuous mx-[20px] mb-[12px] px-[14px] py-[13px] min-h-[94px] rounded-[20px] bg-reverse flex-row items-center"
              layout={reduceMotion ? undefined : LinearTransition.duration(200)}
              style={{
                shadowColor: 'rgb(89,131,240)',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 7,
                elevation: 1,
                overflow: 'visible',
              }}
            >
              <Box className="overflow-hidden border-continuous relative">
                <Box
                  className="overflow-hidden border-continuous"
                  style={{ opacity: hasError ? 0.48 : 1 }}
                >
                  <CommentaryAvatar
                    resourceCode={item.resourceCode}
                    author={item.entry.author}
                    fallback={item.entry.shortName}
                    size={46}
                  />
                </Box>
                <Box
                  className="border-continuous overflow-hidden absolute right-[-1px] bottom-[-1px] rounded-[7px] border-[2px] border-reverse"
                  style={{
                    backgroundColor: resolveThemeColor(stylingTheme, STATUS_COLORS[item.state]),
                    width: 13,
                    height: 13,
                  }}
                />
              </Box>

              <Box
                className="overflow-hidden border-continuous ml-[12px] flex-[1]"
                style={{ opacity: hasError ? 0.52 : 1 }}
              >
                <Text className="font-bold text-[16px]" numberOfLines={1}>
                  {item.entry.shortName}
                </Text>
                <AnimatedBox
                  key={`${item.state}:${item.comment?.id ?? 'empty'}`}
                  entering={reduceMotion ? undefined : FadeIn.duration(150)}
                  exiting={reduceMotion ? undefined : FadeOut.duration(100)}
                  className="overflow-hidden border-continuous"
                >
                  <Text
                    className="mt-[3px] text-grey text-[13px]"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {preview}
                  </Text>
                  {item.comment ? (
                    <Text className="mt-[5px] text-primary text-[11px]" numberOfLines={1}>
                      {formatCommentaryPassageLabel(headerTitle, item.comment)}
                      {(item.comment.matchingSectionCount ?? 1) > 1
                        ? ` · ${t('commentaries.resource.sectionCount', {
                            count: item.comment.matchingSectionCount,
                          })}`
                        : ''}
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
