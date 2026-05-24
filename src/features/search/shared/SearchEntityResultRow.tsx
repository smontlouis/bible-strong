import { TouchableOpacity } from 'react-native'
import type { FuseResultMatch } from 'fuse.js'
import Box, { HStack, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { Chip } from '~common/ui/NewChip'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import SearchTypeIcon from './SearchTypeIcon'
import { mergeRanges, normalizeDisplayedText, normalizeSearchText } from './searchFuzzy'
import type { MatchRange, SearchEntityResult } from './searchResultTypes'

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
        bold={bold}
        fontSize={bold ? 15 : 13}
        color={bold ? undefined : color}
        numberOfLines={1}
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
    <Text bold={bold} fontSize={bold ? 15 : 13} color={bold ? undefined : color} numberOfLines={1}>
      {chunks.map((chunk, index) => (
        <Text
          key={`${chunk.text}-${index}`}
          bold={chunk.highlighted || bold}
          fontSize={bold ? 15 : 13}
          color={chunk.highlighted ? 'primary' : bold ? undefined : color}
          bg={chunk.highlighted ? 'lightPrimary' : undefined}
        >
          {chunk.text}
        </Text>
      ))}
    </Text>
  )
}

const PassageDescription = ({ highlighted }: { highlighted?: string }) => {
  const parts = (highlighted || '').split(/(\{\{.*?\}\})/g)

  return (
    <Paragraph small numberOfLines={1}>
      {parts.map((part, i) => {
        if (part.startsWith('{{') && part.endsWith('}}')) {
          return (
            <Paragraph small bold color="primary" key={i}>
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
}: {
  item: SearchEntityResult
  onPress: () => void
  showArrow?: boolean
  description?: React.ReactNode
  descriptionColor?: string
}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <HStack px={20} py={12} borderBottomWidth={1} borderColor="border" alignItems="center" gap={12}>
      <Box
        width={36}
        height={36}
        borderRadius={10}
        bg="lightGrey"
        alignItems="center"
        justifyContent="center"
      >
        <SearchTypeIcon type={item.iconType} />
      </Box>
      <VStack flex={1}>
        <HStack alignItems="center" gap={6} mb={2}>
          <HighlightedText value={item.title} match={getMatchForKey(item, 'title')} bold />
          {item.chip ? <Chip>{item.chip}</Chip> : null}
          {item.subtitle && item.type === 'passages' ? <Chip>{item.subtitle}</Chip> : null}
        </HStack>
        {description ? (
          description
        ) : item.passage ? (
          <PassageDescription highlighted={item.description} />
        ) : item.description ? (
          <HighlightedText
            value={item.description}
            match={getMatchForKey(item, 'description')}
            color={descriptionColor}
            useExcerpt
          />
        ) : item.subtitle ? (
          <Text fontSize={13} color={descriptionColor} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
      </VStack>
      {showArrow ? <FeatherIcon name="arrow-right" size={20} color="grey" /> : null}
    </HStack>
  </TouchableOpacity>
)

export default SearchEntityResultRow
