import { getReadingTypography, type ReadingTypography } from '~common/readingHtml'
import { useReferencePreview } from '~features/bibleReferencePreview/state'
import { twMerge } from '~common/ui/classNames'

import PageContent from '~common/ui/PageContent'
import Card from '~common/ui/Card'
import { ListSectionTitle, ListSeparator } from '~common/ui/ListSection'
import { formatStrongDisplayCode } from '~helpers/strongIdentities'
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
import {
  linkifyStrongReferences,
  normalizeExternalContextLinks,
  removeLegacySpacerImages,
} from '~common/stylizedHtmlUtils'
import { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type {
  StrongLexiconEntity,
  StrongLexiconEntityRelation,
  StrongLexiconRelation,
} from '~features/resources/strongLexiconAccess'
import { linkifyStrongEditorialBibleReferences } from './strongEditorialHtml'
import { getScaledStrongTextStyle, type StrongReadingTypography } from './strongEditorialHtmlStyles'
import {
  getStrongEditorialPreviewHtml,
  isStrongEditorialPreviewOverflowing,
} from './strongDetailPreview'
import { getStrongEntityAvatarSource } from './strongEntityAvatars'
import { isStrongOriginalUnnamed } from './strongOriginalPresentation'
/** Where the text of a Strong page's cards starts: their inner margin and the start of their hairlines. */
export const STRONG_CARD_INSET = 16

/** The width of a Strong page's column on a wide screen. */
export const STRONG_COLUMN_MAX_WIDTH = 600

/** Rows in one card, split by hairlines that start where their text starts. */
export const StrongRowsCard = ({ children }: { children: React.ReactNode }) => {
  const rows = React.Children.toArray(children)
  return (
    <Card>
      {rows.map((row, index) => (
        <React.Fragment key={React.isValidElement(row) && row.key != null ? row.key : index}>
          {index > 0 && <ListSeparator inset={STRONG_CARD_INSET} />}
          {row}
        </React.Fragment>
      ))}
    </Card>
  )
}

/** Text set inside a card, at its inner margin. */
export const StrongCardBody = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => <VStack className={twMerge('p-[16px] gap-[12px]', className)}>{children}</VStack>

/**
 * A section of a Strong page: its title on the canvas, its content in a card. `body` sets the
 * content at the card's margin, `rows` splits rows by hairlines, `none` leaves the content on the
 * canvas. With `onToggle`, the card opens on a row that names the content.
 */
export const StrongEditorialSection = ({
  title,
  children,
  onLayout,
  subtitle,
  expanded,
  onToggle,
  surface = 'body',
  className,
}: {
  title: string
  children: React.ReactNode
  onLayout?: (event: LayoutChangeEvent) => void
  /** The row of a section that opens: what it holds, such as the reference of a verse. */
  subtitle?: string
  expanded?: boolean
  onToggle?: () => void
  surface?: 'body' | 'rows' | 'none'
  className?: string
}) => (
  <PageContent
    className={twMerge('mt-[26px]', className)}
    style={{ maxWidth: STRONG_COLUMN_MAX_WIDTH }}
    onLayout={onLayout}
  >
    <ListSectionTitle>{title}</ListSectionTitle>
    {onToggle ? (
      <Card>
        <TouchableBox
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: Boolean(expanded) }}
          onPress={onToggle}
          activeOpacity={0.7}
          className="flex-row items-center gap-[12px] px-[16px] py-[12px]"
        >
          <Text className="flex-[1] text-[15px]" numberOfLines={1}>
            {subtitle || title}
          </Text>
          <FeatherIcon name={expanded ? 'chevron-up' : 'chevron-down'} color="grey" size={18} />
        </TouchableBox>
        {expanded && (
          <>
            <ListSeparator inset={STRONG_CARD_INSET} />
            <StrongCardBody>{children}</StrongCardBody>
          </>
        )}
      </Card>
    ) : surface === 'rows' ? (
      <StrongRowsCard>{children}</StrongRowsCard>
    ) : surface === 'body' ? (
      <Card>
        <StrongCardBody>{children}</StrongCardBody>
      </Card>
    ) : (
      <VStack className="gap-[12px]">{children}</VStack>
    )}
  </PageContent>
)

export const StrongLevelSwitch = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) => (
  // The track is recessed into the canvas and the chosen level is raised above it, in every theme.
  <HStack className="overflow-hidden border-continuous bg-opacity5 rounded-full p-[3px] gap-[2px]">
    {options.map(option => {
      const selected = option.value === value
      return (
        <TouchableBox
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected }}
          onPress={() => onChange(option.value)}
          activeOpacity={0.7}
          className={twMerge(
            'overflow-hidden border-continuous flex-[1] items-center rounded-full py-[6px]',
            selected && 'bg-surface-raised'
          )}
        >
          <Text className={twMerge('text-[13px] font-semibold', !selected && 'text-grey')}>
            {option.label}
          </Text>
        </TouchableBox>
      )
    })}
  </HStack>
)

/** The last row of a card, which opens the page that shows all of it. */
export const StrongPreviewLink = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableBox
    className="flex-row items-center gap-[12px] px-[16px] py-[12px]"
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Text className="flex-[1] text-primary text-[15px]">{label}</Text>
    <FeatherIcon name="chevron-right" color="grey" size={18} />
  </TouchableBox>
)

export const StrongLexicalRelationRow = ({
  relation,
  readingTypography,
  onPress,
}: {
  relation: StrongLexiconRelation
  readingTypography: StrongReadingTypography
  onPress: () => void
}) => {
  const code = formatStrongDisplayCode(relation.stepCode)
  return (
    <TouchableBox
      className="flex-row items-center gap-[12px] px-[16px] py-[11px]"
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel={`${relation.gloss}, ${code}`}
    >
      <VStack className="flex-[1] gap-[2px]">
        <Text className="text-[15px]" numberOfLines={2}>
          {relation.gloss || relation.transliteration}
        </Text>
        <Text className="text-[13px] text-grey" numberOfLines={1}>
          {relation.label} · {code}
        </Text>
      </VStack>
      {!isStrongOriginalUnnamed(relation.original) && (
        <Text style={getScaledStrongTextStyle(18, 24, readingTypography)}>{relation.original}</Text>
      )}
      <FeatherIcon name="chevron-right" size={18} color="grey" />
    </TouchableBox>
  )
}

type StrongEditorialHtmlProps = {
  typography?: ReadingTypography
  value?: string
  selectable?: boolean
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}

export const StrongEditorialHtml = ({
  value,
  typography,
  selectable,
  onOpenBibleReference,
  onOpenStrong,
}: StrongEditorialHtmlProps) => {
  const theme = useTheme()
  if (!value) return null

  return (
    <SwitchableHTMLView
      typography={typography}
      selectable={selectable}
      value={linkifyStrongReferences(
        normalizeExternalContextLinks(
          linkifyStrongEditorialBibleReferences(
            removeLegacySpacerImages(value),
            theme.colors.primary
          )
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

// More characters than a line of the preview holds, even on a wide screen.
const PREVIEW_TEXT_PER_LINE = 160

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
  const preview = useReferencePreview()
  const theme = useTheme()
  if (!value) return null
  const html = removeLegacySpacerImages(value)
  // Only what the lines can show: a text cut there overflows them anyway.
  const previewHtml = getStrongEditorialPreviewHtml(html, numberOfLines * PREVIEW_TEXT_PER_LINE)
  const isCut = previewHtml.length < html.length
  const document = parseDocument(
    linkifyStrongEditorialBibleReferences(previewHtml, theme.colors.primary),
    { decodeEntities: true }
  )
  const fullText = DomUtils.textContent(document)
  const reportOverflow = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    onOverflowChange?.(
      isCut ||
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
        onOpenBibleReference: osis => {
          const open = () => onOpenBibleReference(osis)
          if (!preview({ href: `bible://${osis}`, type: 'verse' }, open)) open()
        },
        onOpenStrong: code => {
          const open = () => onOpenStrong(code)
          if (!preview({ href: `strong://${code}`, type: '' }, open)) open()
        },
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

const entityCardPresentation = (compact: boolean) =>
  compact
    ? { avatarSize: 40, nameClassName: 'font-semibold text-[16px]' }
    : { avatarSize: 48, nameClassName: 'font-semibold text-[20px]' }

const resolveEntityEditorialTypography = (
  readingTypography: StrongReadingTypography,
  editorialTypography?: ReadingTypography
) =>
  editorialTypography ??
  getReadingTypography(
    readingTypography.fontFamily || 'sans-serif',
    readingTypography.fontSizeScale,
    readingTypography.lineHeight
  )

/**
 * An entity's avatar, name and description. `plain` leaves out its Strong numbers, `showsKind`
 * the kind of entity when the title above already says it; the page sets it in a card.
 */
export const StrongEntitySummaryCard = ({
  entity,
  expanded = false,
  plain = false,
  compact = false,
  showsKind = true,
  previewLines,
  editorialTypography,
  readingTypography,
  onOpenBibleReference,
  onOpenStrong,
}: {
  entity: StrongLexiconEntity
  expanded?: boolean
  plain?: boolean
  compact?: boolean
  showsKind?: boolean
  /** Truncates the short description; the full text stays on the entity page. */
  previewLines?: number
  editorialTypography?: ReadingTypography
  readingTypography: StrongReadingTypography
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}) => {
  const { t } = useTranslation()
  const detailedDescription = entity.articleHtml || entity.summaryHtml
  const presentation = entityCardPresentation(compact)
  const resolvedEditorialTypography = resolveEntityEditorialTypography(
    readingTypography,
    editorialTypography
  )

  return (
    <VStack className="overflow-hidden border-continuous gap-[13px]">
      <HStack className="overflow-hidden border-continuous gap-[12px] items-center">
        <Image
          source={getStrongEntityAvatarSource(entity.category, entity.type)}
          style={{ width: presentation.avatarSize, height: presentation.avatarSize }}
          contentFit="contain"
        />
        <VStack className="overflow-hidden border-continuous flex-[1] gap-[2px]">
          <Text className={presentation.nameClassName}>{entity.name}</Text>
          {showsKind && (
            <Text className="text-[13px] text-grey">
              {getEntityLabel(entity.category, entity.type, t)}
            </Text>
          )}
          {!plain && (
            <HStack className="overflow-hidden border-continuous gap-[6px] flex-wrap mt-[4px]">
              {entity.strongCodes.map(code => (
                // The chip is set on a card: the canvas is the recessed level in every theme.
                <TouchableBox
                  className="overflow-hidden border-continuous bg-canvas rounded-full px-[9px] py-[3px] flex-row items-center gap-[2px]"
                  key={code}
                  onPress={() => onOpenStrong(code)}
                  activeOpacity={0.7}
                  accessibilityRole="link"
                  accessibilityLabel={formatStrongDisplayCode(code)}
                >
                  <Text className="text-grey text-[12px] font-semibold">
                    {formatStrongDisplayCode(code)}
                  </Text>
                  <FeatherIcon name="chevron-right" color="grey" size={11} />
                </TouchableBox>
              ))}
            </HStack>
          )}
        </VStack>
      </HStack>
      {!!entity.shortDescription && previewLines ? (
        <StrongEditorialPreview
          value={entity.shortDescription}
          readingTypography={readingTypography}
          numberOfLines={previewLines}
          onOpenBibleReference={onOpenBibleReference}
          onOpenStrong={onOpenStrong}
        />
      ) : !!entity.shortDescription ? (
        <StrongEditorialHtml
          value={entity.shortDescription}
          typography={resolvedEditorialTypography}
          onOpenBibleReference={onOpenBibleReference}
          onOpenStrong={onOpenStrong}
        />
      ) : null}
      {expanded && !!detailedDescription && (
        <>
          {!!entity.shortDescription && <ListSeparator inset={0} />}
          <StrongEditorialHtml
            value={detailedDescription}
            typography={resolvedEditorialTypography}
            onOpenBibleReference={onOpenBibleReference}
            onOpenStrong={onOpenStrong}
          />
        </>
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
    <StrongRowsCard>
      {relations.map(relation => (
        <TouchableBox
          className="flex-row items-center gap-[12px] px-[16px] py-[11px]"
          key={`${relation.relation}:${relation.targetUniqueName ?? relation.targetName}`}
          onPress={() => onOpenEntity(relation)}
          disabled={!relation.targetUniqueName}
          activeOpacity={0.7}
          style={{ opacity: !relation.targetUniqueName ? 0.6 : 1 }}
        >
          <VStack className="flex-[1] gap-[2px]">
            <Text className="text-[15px]">{relation.targetName}</Text>
            <Text className="text-grey text-[13px]">
              {t(relationLabelKey(relation.relation), {
                defaultValue: relation.relation,
              })}
            </Text>
          </VStack>
          {!!relation.targetStepCodes?.length && (
            <Text className="text-grey text-[13px]">
              {relation.targetStepCodes.map(formatStrongDisplayCode).join(' · ')}
            </Text>
          )}
          {!!relation.targetUniqueName && (
            <FeatherIcon name="chevron-right" size={18} color="grey" />
          )}
        </TouchableBox>
      ))}
    </StrongRowsCard>
  )
}
