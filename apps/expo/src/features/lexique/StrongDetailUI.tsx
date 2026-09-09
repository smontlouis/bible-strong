import { twMerge } from '~common/ui/classNames'

import PageContent from '~common/ui/PageContent'
import { Image } from 'expo-image'
import { useTheme } from '~themes/ThemeProvider'
import React from 'react'
import {
  Linking,
  Text as NativeText,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native'
import { useTranslation, type TFunction } from 'react-i18next'
import { DomUtils, parseDocument } from 'htmlparser2'
import { hasChildren, isTag, isText, type ChildNode } from 'domhandler'
import SwitchableHTMLView from '~common/SwitchableHTMLView'
import { linkifyStrongReferences, normalizeExternalContextLinks } from '~common/stylizedHtmlUtils'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type {
  StrongLexiconEntity,
  StrongLexiconEntityRelation,
  StrongLexiconRelation,
} from '~features/resources/strongLexiconAccess'
import { linkifyStrongEditorialBibleReferences } from './strongEditorialHtml'
import { getScaledStrongTextStyle, type StrongReadingTypography } from './strongEditorialHtmlStyles'
import { isStrongEditorialPreviewOverflowing } from './strongDetailPreview'
import { getStrongEntityAvatarSource } from './strongEntityAvatars'
import { isStrongOriginalUnnamed } from './strongOriginalPresentation'
export const StrongEyebrow = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-primary text-[11px] font-bold uppercase">{children}</Text>
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
    className="border-continuous overflow-hidden mt-[28px] border-border gap-[12px]"
    onLayout={onLayout}
    style={{ paddingTop: separated ? 24 : 0, borderTopWidth: separated ? 1 : 0 }}
  >
    <PageContent className="gap-[12px]" style={{ maxWidth: 600 }}>
      <StrongEyebrow>{title}</StrongEyebrow>
      {children}
    </PageContent>
  </VStack>
)

export const StrongPreviewLink = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableBox
    className="overflow-hidden border-continuous mt-[2px]"
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <HStack className="overflow-hidden border-continuous items-center gap-[5px] py-[8px]">
      <Text className="text-primary font-bold text-[14px]">{label}</Text>
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
    className="overflow-hidden border-continuous"
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="link"
    accessibilityLabel={`${relation.gloss}, ${relation.stepCode}`}
  >
    <HStack className="overflow-hidden border-continuous bg-light-grey rounded-[17px] px-[15px] py-[13px] items-center gap-[12px]">
      <VStack className="overflow-hidden border-continuous flex-[1] gap-[3px]">
        <Text className="text-tertiary text-[12px]">
          {relation.label} · {relation.stepCode}
        </Text>
        <Text className="font-bold text-[16px]">{relation.gloss || relation.transliteration}</Text>
      </VStack>
      {!isStrongOriginalUnnamed(relation.original) && (
        <Text style={getScaledStrongTextStyle(18, 24, readingTypography)}>{relation.original}</Text>
      )}
      <FeatherIcon name="chevron-right" size={16} color="tertiary" />
    </HStack>
  </TouchableBox>
)

type StrongEditorialHtmlProps = {
  value?: string
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}

export const StrongEditorialHtml = ({
  value,
  onOpenBibleReference,
  onOpenStrong,
}: StrongEditorialHtmlProps) => {
  const theme = useTheme()
  if (!value) return null

  return (
    <SwitchableHTMLView
      value={linkifyStrongReferences(
        normalizeExternalContextLinks(
          linkifyStrongEditorialBibleReferences(value, theme.colors.primary)
        )
      )}
      onLinkPress={target => {
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
      className="text-[18px] leading-[28px]"
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
  const detailedDescription = entity.articleHtml || entity.summaryHtml

  return (
    <VStack
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          expanded || plain ? '' : 'bg-light-grey',
          'overflow-hidden border-continuous gap-[13px]'
        )
      )}
      style={{ padding: expanded || plain ? 0 : 18 }}
    >
      <HStack className="overflow-hidden border-continuous gap-[12px] items-center">
        <Image
          source={getStrongEntityAvatarSource(entity.category, entity.type)}
          style={{ width: 48, height: 48 }}
          contentFit="contain"
        />
        <VStack className="overflow-hidden border-continuous flex-[1] gap-[3px]">
          <StrongEyebrow>{getEntityLabel(entity.category, entity.type, t)}</StrongEyebrow>
          <Text className="font-bold text-[20px]">{entity.name}</Text>
          {!plain && (
            <HStack className="overflow-hidden border-continuous gap-[6px] flex-wrap">
              {entity.strongCodes.map(code => (
                <TouchableBox
                  className="overflow-hidden border-continuous bg-light-grey rounded-[10px] px-[7px] py-[3px] flex-row items-center gap-[2px]"
                  key={code}
                  onPress={() => onOpenStrong(code)}
                  activeOpacity={0.7}
                  accessibilityRole="link"
                  accessibilityLabel={code}
                >
                  <Text className="text-tertiary text-[11px] font-bold">{code}</Text>
                  <FeatherIcon name="chevron-right" color="tertiary" size={10} />
                </TouchableBox>
              ))}
            </HStack>
          )}
        </VStack>
      </HStack>
      {!!entity.shortDescription && (
        <StrongEditorialHtml
          value={entity.shortDescription}
          onOpenBibleReference={onOpenBibleReference}
          onOpenStrong={onOpenStrong}
        />
      )}
      {expanded && !!detailedDescription && (
        <Box
          className="border-continuous overflow-hidden border-border"
          style={{
            paddingTop: entity.shortDescription ? 13 : 0,
            borderTopWidth: entity.shortDescription ? 1 : 0,
          }}
        >
          <StrongEditorialHtml
            value={detailedDescription}
            onOpenBibleReference={onOpenBibleReference}
            onOpenStrong={onOpenStrong}
          />
        </Box>
      )}
    </VStack>
  )
}

const relationLabelKey = (relation: string) => `strongDetail.entity.relation.${relation}`

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
    <VStack className="overflow-hidden border-continuous gap-[8px]">
      {relations.map(relation => (
        <TouchableBox
          className="overflow-hidden border-continuous"
          key={`${relation.relation}:${relation.targetUniqueName ?? relation.targetName}`}
          onPress={() => onOpenEntity(relation)}
          disabled={!relation.targetUniqueName}
          activeOpacity={0.7}
          style={[
            { opacity: !relation.targetUniqueName ? 0.6 : 1 },
            [{ opacity: !relation.targetUniqueName ? 0.6 : 1 }],
          ]}
        >
          <HStack className="overflow-hidden border-continuous bg-light-grey rounded-[14px] px-[13px] py-[11px] gap-[10px] items-center">
            <VStack className="overflow-hidden border-continuous flex-[1] gap-[2px]">
              <Text className="font-bold">{relation.targetName}</Text>
              <Text className="text-tertiary text-[11px]">
                {t(relationLabelKey(relation.relation), {
                  defaultValue: relation.relation,
                })}
              </Text>
            </VStack>
            {!!relation.targetStepCodes?.length && (
              <Text className="text-tertiary text-[11px]">
                {relation.targetStepCodes.join(' · ')}
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
