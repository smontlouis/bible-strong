import { getReadingTypography, type ReadingTypography } from '~common/readingHtml'
import { useReferencePreview } from '~features/bibleReferencePreview/state'

import { ListSeparator } from '~common/ui/ListSection'
import { StudyRowsCard } from '~common/ui/StudySection'
import { formatStrongDisplayCode } from '~helpers/strongIdentities'
import { useTheme } from '~themes/ThemeProvider'
import React from 'react'
import {
  Linking,
  Text as NativeText,
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
import StrongEntityAvatar from './StrongEntityAvatar'
import { useEntityPortraitCatalog } from './entityPortraitManifest'
import { getEntityPortraitText } from './entityPortraits'
import { isStrongOriginalUnnamed } from './strongOriginalPresentation'
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

export const getEntityLabel = (
  category: string,
  type: string,
  t: TFunction<'translation', undefined>
) => {
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
 * the kind of entity when the title above already says it; the page sets it in a card. `featured`
 * gives a painted entity a larger portrait, its title and its roles; `hidesHeader` leaves only the
 * description, under a profile's own head.
 */
export const StrongEntitySummaryCard = ({
  entity,
  expanded = false,
  plain = false,
  compact = false,
  showsKind = true,
  featured = false,
  hidesHeader = false,
  language,
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
  featured?: boolean
  hidesHeader?: boolean
  /** The language of the portrait's title and roles; the app's by default. */
  language?: string
  /** Truncates the short description; the full text stays on the entity page. */
  previewLines?: number
  editorialTypography?: ReadingTypography
  readingTypography: StrongReadingTypography
  onOpenBibleReference: (osis: string) => void
  onOpenStrong: (stepCode: string) => void
}) => {
  const { t, i18n } = useTranslation()
  const catalog = useEntityPortraitCatalog()
  const detailedDescription = entity.articleHtml || entity.summaryHtml
  const portrait = featured ? catalog?.entities[entity.uniqueName] : undefined
  const textLanguage = language ?? i18n.language
  const presentation = portrait
    ? { avatarSize: 72, nameClassName: 'font-semibold text-[20px]' }
    : entityCardPresentation(compact)
  const roles = (portrait?.roles ?? []).flatMap(role =>
    catalog?.roles[role] ? [getEntityPortraitText(catalog.roles[role], textLanguage)] : []
  )
  const resolvedEditorialTypography = resolveEntityEditorialTypography(
    readingTypography,
    editorialTypography
  )

  return (
    <VStack className="overflow-hidden border-continuous gap-[13px]">
      {!hidesHeader && (
        <HStack className="overflow-hidden border-continuous gap-[12px] items-center">
          <StrongEntityAvatar
            uniqueName={entity.uniqueName}
            category={entity.category}
            type={entity.type}
            size={presentation.avatarSize}
          />
          <VStack className="overflow-hidden border-continuous flex-[1] gap-[2px]">
            <Text className={presentation.nameClassName}>{entity.name}</Text>
            {!!portrait?.title && (
              <Text className="text-[15px] text-grey" style={{ fontFamily: 'Literata Book' }}>
                {getEntityPortraitText(portrait.title, textLanguage)}
              </Text>
            )}
            {portrait ? (
              <Text className="text-[13px] text-grey">
                {[getEntityLabel(entity.category, entity.type, t), ...roles].join(' · ')}
              </Text>
            ) : (
              showsKind && (
                <Text className="text-[13px] text-grey">
                  {getEntityLabel(entity.category, entity.type, t)}
                </Text>
              )
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
      )}
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
    <StudyRowsCard>
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
    </StudyRowsCard>
  )
}
