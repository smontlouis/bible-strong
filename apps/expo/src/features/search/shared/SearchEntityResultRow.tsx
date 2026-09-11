import { twMerge } from '~common/ui/classNames'
import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { TouchableOpacity } from 'react-native'
import type { FuseResultMatch } from 'fuse.js'
import { HStack, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { Chip } from '~common/ui/NewChip'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { searchTypeIconConfig } from './SearchTypeIcon'
import { mergeRanges, normalizeDisplayedText, normalizeSearchText } from './searchFuzzy'
import type { MatchRange, SearchEntityResult } from './searchResultTypes'
import { getPassageSearchExcerpt } from './searchPassageExcerpt'
const getMatchForKey = (item: SearchEntityResult, key: string) =>
  item.matches?.find(match => match.key === key)

const filterUsefulRanges = (ranges: readonly MatchRange[]) =>
  mergeRanges(ranges).filter(([start, end]) => end - start + 1 >= 3)

const getExcerpt = (value: string, ranges: readonly MatchRange[], context = 26) => {
  const firstRange = ranges[0]
  const sourceText = normalizeDisplayedText(value)
  const normalizedSourceText = normalizeSearchText(sourceText)
  const matchedText = firstRange ? value.slice(firstRange[0], firstRange[1] + 1) : ''
  const normalizedMatchedText = normalizeSearchText(matchedText)
  const displayedMatchStart = normalizedMatchedText
    ? normalizedSourceText.indexOf(normalizedMatchedText)
    : -1

  if (displayedMatchStart === -1) {
    return {
      text: sourceText,
      ranges: [],
    }
  }

  const displayedRange: MatchRange = [
    displayedMatchStart,
    displayedMatchStart + normalizedMatchedText.length - 1,
  ]

  if (!firstRange || value.length <= 90) {
    return {
      text: sourceText,
      ranges: [displayedRange],
    }
  }

  const start = Math.max(0, displayedRange[0] - context)
  const end = Math.min(sourceText.length, displayedRange[1] + context)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < sourceText.length ? '...' : ''
  const text = `${prefix}${sourceText.slice(start, end)}${suffix}`
  const offset = start - prefix.length

  return {
    text,
    ranges: [
      [
        Math.max(0, displayedRange[0] - offset),
        Math.min(text.length - 1, displayedRange[1] - offset),
      ],
    ],
  }
}

export const HighlightedText = ({
  value,
  match,
  ranges,
  bold,
  color = 'grey',
  useExcerpt,
}: {
  value?: string
  match?: FuseResultMatch
  ranges?: readonly MatchRange[]
  bold?: boolean
  color?: string
  useExcerpt?: boolean
}) => {
  const stylingTheme = useStylingTheme()

  const sourceText = normalizeDisplayedText(value)
  const mergedRanges = ranges
    ? filterUsefulRanges(ranges)
    : match
      ? mergeRanges(match.indices as MatchRange[])
      : []

  if (!sourceText) return null

  if (!mergedRanges.length) {
    return (
      <Text
        numberOfLines={1}
        style={{
          fontSize: bold ? 15 : 13,
          color:
            resolveThemeColor(stylingTheme, bold ? undefined : color) ||
            stylingTheme.colors.default,
          fontWeight: bold ? 'bold' : undefined,
        }}
      >
        {sourceText}
      </Text>
    )
  }

  const display = useExcerpt
    ? getExcerpt(value || '', mergedRanges)
    : { text: sourceText, ranges: mergedRanges }
  const chunks: { text: string; highlighted: boolean }[] = []
  let cursor = 0

  display.ranges.forEach(([start, end]) => {
    if (start > cursor) {
      chunks.push({ text: display.text.slice(cursor, start), highlighted: false })
    }
    chunks.push({ text: display.text.slice(start, end + 1), highlighted: true })
    cursor = end + 1
  })

  if (cursor < display.text.length) {
    chunks.push({ text: display.text.slice(cursor), highlighted: false })
  }

  return (
    <Text
      numberOfLines={1}
      style={{
        fontSize: bold ? 15 : 13,
        color:
          resolveThemeColor(stylingTheme, bold ? undefined : color) || stylingTheme.colors.default,
        fontWeight: bold ? 'bold' : undefined,
      }}
    >
      {chunks.map((chunk, index) => (
        <Text
          key={`${chunk.text}-${index}`}
          style={{
            fontSize: bold ? 15 : 13,
            color:
              resolveThemeColor(
                stylingTheme,
                chunk.highlighted ? 'primary' : bold ? undefined : color
              ) || stylingTheme.colors.default,
            fontWeight: chunk.highlighted || bold ? 'bold' : undefined,
          }}
          className={twMerge(chunk.highlighted ? 'bg-light-primary' : '')}
        >
          {chunk.text}
        </Text>
      ))}
    </Text>
  )
}

const PassageDescription = ({ highlighted }: { highlighted?: string }) => {
  const parts = getPassageSearchExcerpt(highlighted || '').split(/(\{\{.*?\}\})/g)

  return (
    <Paragraph small numberOfLines={1}>
      {parts.map((part, i) => {
        if (part.startsWith('{{') && part.endsWith('}}')) {
          return (
            <Paragraph className="font-bold text-primary" small key={i}>
              {part.slice(2, -2)}
            </Paragraph>
          )
        }
        return part
      })}
    </Paragraph>
  )
}

export const SearchEntityResultRow = ({
  item,
  onPress,
  showArrow,
  description,
  descriptionColor = 'grey',
  actions,
}: {
  item: SearchEntityResult
  onPress: () => void
  showArrow?: boolean
  description?: React.ReactNode
  descriptionColor?: string
  actions?: React.ReactNode
}) => {
  const stylingTheme = useStylingTheme()
  return (
    <HStack
      className="border-continuous overflow-hidden border-b-[1px] border-l-[3px] border-border items-center"
      style={{
        borderLeftColor: resolveThemeColor(stylingTheme, searchTypeIconConfig[item.iconType].color),
      }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onPress}
        activeOpacity={0.7}
        style={{ flex: 1, minWidth: 0, paddingHorizontal: 20, paddingVertical: 12 }}
      >
        <VStack className="overflow-hidden border-continuous">
          <HStack className="overflow-hidden border-continuous items-center gap-[6px] mb-[2px]">
            <HighlightedText value={item.title} match={getMatchForKey(item, 'title')} bold />
            {item.chip ? <Chip>{item.chip}</Chip> : null}
            {item.subtitle && item.type === 'passages' ? <Chip>{item.subtitle}</Chip> : null}
          </HStack>
          {description ? (
            description
          ) : item.passage ? (
            <VStack className="overflow-hidden border-continuous gap-[3px]">
              <PassageDescription highlighted={item.description} />
              {item.passageReason ? (
                <Text className="text-[11px] text-grey" numberOfLines={1}>
                  {item.passageReason}
                </Text>
              ) : null}
            </VStack>
          ) : item.description ? (
            <HighlightedText
              value={item.description}
              match={getMatchForKey(item, 'description')}
              color={descriptionColor}
              useExcerpt
            />
          ) : item.subtitle ? (
            <Text
              className="text-[13px]"
              numberOfLines={1}
              style={{
                color:
                  resolveThemeColor(stylingTheme, descriptionColor) || stylingTheme.colors.default,
              }}
            >
              {item.subtitle}
            </Text>
          ) : null}
        </VStack>
      </TouchableOpacity>
      {actions ? (
        <HStack className="shrink-0 items-center pr-[16px] py-[12px]">{actions}</HStack>
      ) : showArrow ? (
        <TouchableOpacity
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          style={{ padding: 20 }}
        >
          <FeatherIcon name="arrow-right" size={20} color="grey" />
        </TouchableOpacity>
      ) : null}
    </HStack>
  )
}

export default SearchEntityResultRow
