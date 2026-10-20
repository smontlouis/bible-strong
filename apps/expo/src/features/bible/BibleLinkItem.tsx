import LinkOptionsPanel from './LinkOptionsPanel'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, Theme } from '~themes/ThemeProvider'
import distanceInWords from 'date-fns/formatDistance'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import EntityChipList from '~common/EntityChipList'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import IconTile, { ICON_TILE_SIZE } from '~common/ui/IconTile'
import Text from '~common/ui/Text'

import { useTranslation } from 'react-i18next'
import { FeatherIcon } from '~common/ui/Icon'
import { linkTypeConfig } from '~helpers/fetchOpenGraphData'
import { getDateLocale } from '~helpers/languageUtils'
import useLanguage from '~helpers/useLanguage'
import { useMountTime } from '~helpers/useMountTime'
import { Link as LinkType } from '~redux/modules/user'

const LinkItemContainer = (
  componentProps: Omit<UIComponentProps<typeof Link>, keyof { theme: Theme } | 'theme'> &
    Omit<{ theme: Theme }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('flex-row items-start pl-[20px] py-[16px]', className)
  return (
    <Link
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Link>['style']}
    />
  )
}

/** Where the row's text starts, after its 20pt gutter, its icon tile and the gap. */
const TEXT_INSET = 20 + ICON_TILE_SIZE + 12

type TLink = {
  linkId: string
  reference: string
  link: LinkType
}

type Props = {
  item: TLink
  onPress: (linkId: string) => void
  relationCount?: number
  onRelationPress?: () => void
}

const BibleLinkItem = ({ item, onPress, relationCount, onRelationPress }: Props) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const lang = useLanguage()
  const mountTime = useMountTime()

  const formattedDate = distanceInWords(Number(item.link.date), mountTime, {
    locale: getDateLocale(lang),
  })

  const config = linkTypeConfig[item.link.linkType] || linkTypeConfig.website
  const iconName = config.icon as React.ComponentProps<typeof FeatherIcon>['name']
  const displayTitle = item.link.customTitle || item.link.ogData?.title || item.link.url
  const relativeDate = t('Il y a {{formattedDate}}', { formattedDate })
  const hasChips = Boolean(Object.keys(item.link.tags || {}).length || relationCount)

  return (
    <Box className="overflow-hidden border-continuous">
      <LinkItemContainer onPress={() => onPress(item.linkId)}>
        {/* A brand fill with a white glyph: a tint would lose the black brands in dark themes. */}
        <IconTile bg={config.color} className="mr-[12px]">
          {config.textIcon ? (
            <Text className="font-bold text-[14px] text-[white]">{config.textIcon}</Text>
          ) : (
            <FeatherIcon name={iconName} size={16} color="white" />
          )}
        </IconTile>
        <Box className="overflow-hidden border-continuous flex-[1]">
          <Text className="text-[12px] text-dark-grey" numberOfLines={1}>
            {!!item.reference && (
              <Text className="text-[12px] font-semibold text-grey">{item.reference}</Text>
            )}
            {item.reference ? ` · ${relativeDate}` : relativeDate}
          </Text>
          <Text
            className="mt-[6px] text-[16px] leading-[22px]"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {displayTitle}
          </Text>
          <Text className="mt-[2px] text-[13px] leading-[18px] text-tertiary" numberOfLines={1}>
            {item.link.url}
          </Text>
          {hasChips && (
            <Box className="overflow-hidden border-continuous pt-[5px]">
              <EntityChipList
                tags={item.link.tags}
                relationCount={relationCount}
                onRelationPress={onRelationPress}
              />
            </Box>
          )}
        </Box>
        {/* The 54pt trigger centres its icon on the header line. */}
        <Box className="overflow-hidden border-continuous mt-[-19px] mr-[4px]">
          <LinkOptionsPanel linkId={item.linkId} onRelations={onRelationPress} />
        </Box>
      </LinkItemContainer>
      <Border style={{ marginLeft: TEXT_INSET }} />
    </Box>
  )
}

export default BibleLinkItem
