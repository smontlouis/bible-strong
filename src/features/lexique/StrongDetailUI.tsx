import { Image } from 'expo-image'
import { useTheme } from '@emotion/react'
import React, { useState } from 'react'
import {
  Linking,
  Text as NativeText,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { useTranslation, type TFunction } from 'react-i18next'
import { DomUtils, parseDocument } from 'htmlparser2'
import { hasChildren, isTag, isText, type ChildNode } from 'domhandler'

import StylizedHTMLView from '~common/StylizedHTMLView'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type {
  StrongLexiconEntity,
  StrongLexiconEntityRelation,
  StrongLexiconRelation,
} from '~features/resources/strongLexiconAccess'
import { linkifyStrongEditorialBibleReferences } from './strongEditorialHtml'
import {
  getScaledStrongTextStyle,
  getStrongEditorialHtmlStyles,
  type StrongReadingTypography,
} from './strongEditorialHtmlStyles'
import { isStrongEditorialPreviewOverflowing } from './strongDetailPreview'
import { getStrongEntityPresentation, splitStrongEntityRelations } from './strongEntityPresentation'

export const StrongEyebrow = ({ children }: { children: React.ReactNode }) => (
  <Text color="primary" fontSize={11} bold textTransform="uppercase">
    {children}
  </Text>
)

export const StrongEditorialSection = ({
  title,
  children,
  onLayout,
  separated = false,
}: {
  title: string
  children: React.ReactNode
  onLayout?: (event: LayoutChangeEvent) => void
  separated?: boolean
}) => (
  <VStack
    mt={28}
    pt={separated ? 24 : 0}
    borderTopWidth={separated ? 1 : 0}
    borderColor="border"
    gap={12}
    onLayout={onLayout}
  >
    <StrongEyebrow>{title}</StrongEyebrow>
    {children}
  </VStack>
)

export const StrongPreviewLink = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableBox
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={label}
    mt={2}
  >
    <HStack alignItems="center" gap={5} py={8}>
      <Text color="primary" bold fontSize={14}>
        {label}
      </Text>
      <FeatherIcon name="chevron-right" color="primary" size={15} />
    </HStack>
  </TouchableBox>
)

export const StrongLexicalRelationCard = ({
  relation,
  readingTypography,
  onPress,
}: {
  relation: StrongLexiconRelation
  readingTypography: StrongReadingTypography
  onPress: () => void
}) => (
  <TouchableBox
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="link"
    accessibilityLabel={`${relation.gloss}, ${relation.stepCode}`}
  >
    <HStack bg="lightGrey" borderRadius={17} px={15} py={13} alignItems="center" gap={12}>
      <VStack flex gap={3}>
        <Text color="tertiary" fontSize={12}>
          {relation.label} · {relation.stepCode}
        </Text>
        <Text bold fontSize={16}>
          {relation.gloss || relation.transliteration}
        </Text>
      </VStack>
      {!!relation.original && (
        <Text style={getScaledStrongTextStyle(18, 24, readingTypography)}>{relation.original}</Text>
      )}
      <FeatherIcon name="chevron-right" size={16} color="tertiary" />
    </HStack>
  </TouchableBox>
)

type StrongEditorialHtmlProps = {
  value?: string
  readingTypography: StrongReadingTypography
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}

export const StrongEditorialHtml = ({
  value,
  readingTypography,
  onOpenBibleReference,
  onOpenStrong,
}: StrongEditorialHtmlProps) => {
  const theme = useTheme()
  if (!value) return null

  return (
    <StylizedHTMLView
      value={linkifyStrongEditorialBibleReferences(value, theme.colors.primary)}
      htmlStyle={getStrongEditorialHtmlStyles(theme, readingTypography)}
      additionalSystemFonts={
        readingTypography.fontFamily ? [readingTypography.fontFamily] : undefined
      }
      onLinkPress={(target, metadata) => {
        if (typeof metadata === 'number') {
          onOpenStrong(`${metadata <= 39 ? 'H' : 'G'}${target}`)
          return
        }
        if (target.startsWith('bible://')) {
          onOpenBibleReference(target.slice('bible://'.length))
          return
        }
        if (target.startsWith('strong://')) {
          onOpenStrong(target.slice('strong://'.length))
          return
        }
        if (/^https?:\/\//iu.test(target)) Linking.openURL(target)
      }}
    />
  )
}

type EditorialPreviewLinkOptions = {
  linkColor: string
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}

const openEditorialPreviewLink = (
  target: string,
  { onOpenBibleReference, onOpenStrong }: EditorialPreviewLinkOptions
) => {
  if (target.startsWith('bible://')) {
    onOpenBibleReference(target.slice('bible://'.length))
    return
  }
  if (target.startsWith('strong://')) {
    onOpenStrong(target.slice('strong://'.length))
    return
  }
  if (/^https?:\/\//iu.test(target)) Linking.openURL(target)
}

const renderEditorialPreviewNodes = (
  nodes: ChildNode[],
  linkOptions: EditorialPreviewLinkOptions,
  path = 'preview'
): React.ReactNode[] =>
  nodes.flatMap((node, index) => {
    const key = `${path}-${index}`
    if (isText(node)) return node.data
    if (!hasChildren(node)) return []
    if (!isTag(node)) return renderEditorialPreviewNodes(node.children, linkOptions, key)

    const tagName = node.name.toLowerCase()
    if (tagName === 'br') return '\n'

    const children = renderEditorialPreviewNodes(node.children, linkOptions, key)
    if (tagName === 'a' && node.attribs.href) {
      return (
        <NativeText
          key={key}
          accessibilityRole="link"
          onPress={() => openEditorialPreviewLink(node.attribs.href, linkOptions)}
          style={{ color: linkOptions.linkColor }}
        >
          {children}
        </NativeText>
      )
    }
    if (tagName === 'b' || tagName === 'strong') {
      return (
        <NativeText key={key} style={{ fontWeight: '700' }}>
          {children}
        </NativeText>
      )
    }
    if (tagName === 'i' || tagName === 'em') {
      return (
        <NativeText key={key} style={{ fontStyle: 'italic' }}>
          {children}
        </NativeText>
      )
    }
    if (['div', 'li', 'p', 'level2', 'level3'].includes(tagName)) {
      return (
        <React.Fragment key={key}>
          {children}
          {'\n'}
        </React.Fragment>
      )
    }
    return <React.Fragment key={key}>{children}</React.Fragment>
  })

export const StrongEditorialPreview = ({
  value,
  readingTypography,
  numberOfLines = 5,
  onOverflowChange,
  onOpenBibleReference,
  onOpenStrong,
}: {
  value?: string
  readingTypography: StrongReadingTypography
  numberOfLines?: number
  onOverflowChange?: (overflows: boolean) => void
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}) => {
  const theme = useTheme()
  if (!value) return null
  const document = parseDocument(
    linkifyStrongEditorialBibleReferences(value, theme.colors.primary),
    { decodeEntities: true }
  )
  const fullText = DomUtils.textContent(document)
  const reportOverflow = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    onOverflowChange?.(
      isStrongEditorialPreviewOverflowing(
        fullText,
        event.nativeEvent.lines.map(line => line.text),
        numberOfLines
      )
    )
  }

  return (
    <Text
      fontSize={18}
      lineHeight={28}
      numberOfLines={numberOfLines}
      ellipsizeMode="tail"
      onTextLayout={reportOverflow}
      style={getScaledStrongTextStyle(18, 28, readingTypography)}
    >
      {renderEditorialPreviewNodes(document.children, {
        linkColor: theme.colors.primary,
        onOpenBibleReference,
        onOpenStrong,
      })}
    </Text>
  )
}

const getEntityLabel = (category: string, type: string, t: TFunction<'translation', undefined>) => {
  if (category === 'person') return t('strongDetail.entity.person')
  if (category === 'place') return t('strongDetail.entity.place')
  if (category === 'group') return t('strongDetail.entity.group')
  const typeKey = type.toLowerCase()
  return t(`strongDetail.entity.type.${typeKey}`, { defaultValue: type })
}

export const StrongEntitySummaryCard = ({
  entity,
  expanded = false,
  plain = false,
  readingTypography,
  onOpenBibleReference,
  onOpenStrong,
}: {
  entity: StrongLexiconEntity
  expanded?: boolean
  plain?: boolean
  readingTypography: StrongReadingTypography
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}) => {
  const { t } = useTranslation()
  const presentation = getStrongEntityPresentation(entity)
  const detailedDescription = entity.articleHtml || entity.summaryHtml

  return (
    <VStack
      bg={expanded || plain ? undefined : 'lightGrey'}
      borderRadius={20}
      p={expanded || plain ? 0 : 18}
      gap={13}
    >
      <HStack gap={12} alignItems="center">
        <Box size={48} borderRadius={24} bg="lightPrimary" center>
          <FeatherIcon name={presentation.icon} color="primary" size={23} />
        </Box>
        <VStack flex gap={3}>
          <StrongEyebrow>{getEntityLabel(entity.category, entity.type, t)}</StrongEyebrow>
          <Text bold fontSize={20}>
            {entity.name}
          </Text>
          {!plain && (
            <Text color="tertiary" fontSize={12}>
              {entity.uStrong}
            </Text>
          )}
        </VStack>
      </HStack>
      {!!entity.shortDescription && (
        <StrongEditorialHtml
          value={entity.shortDescription}
          readingTypography={readingTypography}
          onOpenBibleReference={onOpenBibleReference}
          onOpenStrong={onOpenStrong}
        />
      )}
      {expanded && !!detailedDescription && (
        <Box
          pt={entity.shortDescription ? 13 : 0}
          borderTopWidth={entity.shortDescription ? 1 : 0}
          borderColor="border"
        >
          <StrongEditorialHtml
            value={detailedDescription}
            readingTypography={readingTypography}
            onOpenBibleReference={onOpenBibleReference}
            onOpenStrong={onOpenStrong}
          />
        </Box>
      )}
    </VStack>
  )
}

const PERSON_IMAGE = require('./prototypes/strong-detail/assets/male.png')
const WOMAN_IMAGE = require('./prototypes/strong-detail/assets/female.png')

const relationLabelKey = (relation: string) => `strongDetail.entity.relation.${relation}`

const EntityGraphNode = ({
  name,
  type,
  code,
  center = false,
}: {
  name: string
  type?: string
  code?: string
  center?: boolean
}) => (
  <VStack alignItems="center" gap={4}>
    <Box
      size={center ? 82 : 58}
      borderRadius={center ? 41 : 29}
      bg={center ? 'lightPrimary' : 'lightGrey'}
      borderWidth={center ? 2 : 1}
      borderColor={center ? 'primary' : 'border'}
      center
    >
      <Image
        source={type === 'Female' ? WOMAN_IMAGE : PERSON_IMAGE}
        style={{ width: center ? 76 : 54, height: center ? 76 : 54 }}
        contentFit="contain"
      />
    </Box>
    <Text bold fontSize={center ? 15 : 12} textAlign="center" numberOfLines={2}>
      {name}
    </Text>
    {!!code && (
      <Text color="tertiary" fontSize={10}>
        {code}
      </Text>
    )}
  </VStack>
)

const graphPosition = (index: number, width: number) => {
  const center = width / 2
  const positions = [
    { x: center, y: 52 },
    { x: 54, y: 246 },
    { x: width - 54, y: 246 },
    { x: 54, y: 72 },
    { x: width - 54, y: 72 },
    { x: center, y: 286 },
  ]
  return positions[index] ?? positions[5]
}

export const StrongEntityRelationGraph = ({
  entity,
  onOpenEntity,
}: {
  entity: StrongLexiconEntity
  onOpenEntity: (relation: StrongLexiconEntityRelation) => void
}) => {
  const { t } = useTranslation()
  const [width, setWidth] = useState(330)
  const { graph } = splitStrongEntityRelations(entity)
  if (!graph.length) return null
  const center = { x: width / 2, y: 164 }

  return (
    <Box
      height={340}
      borderWidth={1}
      borderColor="border"
      borderRadius={24}
      bg="reverse"
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      <Svg width={width} height={340} style={{ position: 'absolute', inset: 0 }}>
        {graph.map((relation, index) => {
          const position = graphPosition(index, width)
          return (
            <Line
              key={`${relation.relation}:${relation.targetUniqueName ?? relation.targetName}`}
              x1={center.x}
              y1={center.y}
              x2={position.x}
              y2={position.y}
              stroke="#c8d4e8"
              strokeWidth={1.4}
            />
          )
        })}
      </Svg>

      <Box position="absolute" left={center.x - 48} top={108} width={96}>
        <EntityGraphNode name={entity.name} type={entity.type} code={entity.uStrong} center />
      </Box>

      {graph.map((relation, index) => {
        const position = graphPosition(index, width)
        return (
          <TouchableBox
            key={`${relation.relation}:${relation.targetUniqueName ?? relation.targetName}`}
            position="absolute"
            left={position.x - 46}
            top={position.y - 40}
            width={92}
            alignItems="center"
            onPress={() => onOpenEntity(relation)}
            disabled={!relation.targetUniqueName}
            activeOpacity={0.7}
            accessibilityRole={relation.targetUniqueName ? 'link' : undefined}
          >
            <EntityGraphNode
              name={relation.targetName}
              type={relation.targetType}
              code={relation.targetUStrong}
            />
            <Box bg="lightPrimary" borderRadius={12} px={7} py={3} mt={3}>
              <Text color="primary" fontSize={9} bold numberOfLines={1}>
                {t(relationLabelKey(relation.relation), {
                  defaultValue: relation.relation,
                })}
              </Text>
            </Box>
          </TouchableBox>
        )
      })}
    </Box>
  )
}

export const StrongEntityRelationList = ({
  relations,
  onOpenEntity,
}: {
  relations: StrongLexiconEntityRelation[]
  onOpenEntity: (relation: StrongLexiconEntityRelation) => void
}) => {
  const { t } = useTranslation()
  if (!relations.length) return null

  return (
    <VStack gap={8}>
      {relations.map(relation => (
        <TouchableBox
          key={`${relation.relation}:${relation.targetUniqueName ?? relation.targetName}`}
          onPress={() => onOpenEntity(relation)}
          disabled={!relation.targetUniqueName}
          activeOpacity={0.7}
        >
          <HStack bg="lightGrey" borderRadius={14} px={13} py={11} gap={10} alignItems="center">
            <VStack flex gap={2}>
              <Text bold>{relation.targetName}</Text>
              <Text color="tertiary" fontSize={11}>
                {t(relationLabelKey(relation.relation), {
                  defaultValue: relation.relation,
                })}
              </Text>
            </VStack>
            {!!relation.targetUStrong && (
              <Text color="tertiary" fontSize={11}>
                {relation.targetUStrong}
              </Text>
            )}
            {!!relation.targetUniqueName && (
              <FeatherIcon name="chevron-right" size={15} color="tertiary" />
            )}
          </HStack>
        </TouchableBox>
      ))}
    </VStack>
  )
}
