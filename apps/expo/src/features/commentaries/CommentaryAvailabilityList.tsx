import CommentaryManageButton from './CommentaryManageButton'
import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Card from '~common/ui/Card'
import { ListSeparator } from '~common/ui/ListSection'
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
        <CommentaryManageButton onPress={onManage} />
      </Box>

      <Card className="mx-[20px] mt-[6px]">
        {items.map((item, index) => {
          const hasError = item.state === 'unavailable'
          const preview = item.comment?.content
            ? item.comment.content
            : item.state === 'chapter'
              ? t('commentaries.availability.chapterPreview')
              : item.state === 'unavailable'
                ? item.unavailableCause === 'offline-copy-required'
                  ? t('commentaries.availability.offlineCopyRequiredPreview')
                  : item.unavailableCause === 'invalid-offline-copy'
                    ? t('downloads.invalidCopy')
                    : t('commentaries.availability.errorPreview')
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
              style={{ opacity: hasError ? 0.6 : 1 }}
            >
              {/* One card holds the commentaries; a hairline starts where a row's text starts. */}
              {index > 0 && <ListSeparator inset={14 + 46 + 12} />}
              <AnimatedBox
                className="overflow-hidden border-continuous px-[14px] py-[12px] min-h-[80px] flex-row items-center"
                layout={reduceMotion ? undefined : LinearTransition.duration(200)}
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
                    className="border-continuous overflow-hidden absolute right-[-1px] bottom-[-1px] rounded-full border-[2px] border-surface"
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
                  <Text className="font-semibold text-[15px]" numberOfLines={1}>
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
                      <Text className="mt-[3px] text-grey text-[12px]" numberOfLines={1}>
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
      </Card>
    </AnimatedBox>
  )
}

export default CommentaryAvailabilityList
