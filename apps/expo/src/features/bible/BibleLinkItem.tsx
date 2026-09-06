import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, Theme, useTheme } from '~themes/ThemeProvider'
import distanceInWords from 'date-fns/formatDistance'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import * as Icon from '@expo/vector-icons'

import EntityChipList from '~common/EntityChipList'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import { useTranslation } from 'react-i18next'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import { linkTypeConfig } from '~helpers/fetchOpenGraphData'
import { getDateLocale } from '~helpers/languageUtils'
import truncate from '~helpers/truncate'
import useLanguage from '~helpers/useLanguage'
import { useMountTime } from '~helpers/useMountTime'
import { Link as LinkType } from '~redux/modules/user'

const LinkItemContainer = (
  componentProps: Omit<UIComponentProps<typeof Link>, keyof { theme: Theme } | 'theme'> &
    Omit<{ theme: Theme }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('py-[20px] p-[20px] pr-[0px] flex-row', className)
  )
  return (
    <Link
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Link>['style']}
    />
  )
}

const LinkTypeIcon = (
  componentProps: Omit<UIComponentProps<typeof Box>, keyof { bgColor: string } | 'theme'> &
    Omit<{ bgColor: string }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { bgColor } = props
  const classStyles = useResolveClassNames(
    twMerge('w-[24px] h-[24px] rounded-[4px] mr-[10px] items-center justify-center', className)
  )
  return (
    <Box
      {...props}
      style={
        [classStyles, { backgroundColor: bgColor }, props.style] as UIComponentProps<
          typeof Box
        >['style']
      }
      className="overflow-hidden border-continuous"
    />
  )
}

type TLink = {
  linkId: string
  reference: string
  link: LinkType
}

type Props = {
  item: TLink
  onPress: (linkId: string) => void
  onMenuPress: (linkId: string) => void
  relationCount?: number
  onRelationPress?: () => void
}

const BibleLinkItem = ({ item, onPress, onMenuPress, relationCount, onRelationPress }: Props) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const theme = useTheme()
  const lang = useLanguage()
  const mountTime = useMountTime()

  const formattedDate = distanceInWords(Number(item.link.date), mountTime, {
    locale: getDateLocale(lang),
  })

  const config = linkTypeConfig[item.link.linkType] || linkTypeConfig.website
  const iconName = config.icon as React.ComponentProps<typeof FeatherIcon>['name']
  const displayTitle = item.link.customTitle || item.link.ogData?.title || item.link.url
  const relativeDate = t('Il y a {{formattedDate}}', { formattedDate })
  const metadataLabel = item.reference ? `${item.reference} - ${relativeDate}` : relativeDate

  return (
    <Box className="overflow-hidden border-continuous">
      <LinkItemContainer onPress={() => onPress(item.linkId)}>
        <LinkTypeIcon bgColor={config.color}>
          {config.textIcon ? (
            <Text className="font-bold text-[12px] text-[white]">{config.textIcon}</Text>
          ) : (
            <FeatherIcon name={iconName} size={14} color="white" />
          )}
        </LinkTypeIcon>
        <Box className="overflow-hidden border-continuous flex-[1]">
          <Box className="overflow-hidden border-continuous flex-row justify-between">
            <Text className="text-dark-grey font-bold text-[11px]">{metadataLabel}</Text>
          </Box>
          <Text
            className="text-[16px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {truncate(displayTitle, 50)}
          </Text>
          <Paragraph className="text-tertiary" scale={-3} scaleLineHeight={-1} numberOfLines={1}>
            {item.link.url}
          </Paragraph>
          <EntityChipList
            tags={item.link.tags}
            relationCount={relationCount}
            onRelationPress={onRelationPress}
          />
        </Box>
        <Link
          accessibilityLabel={t('accessibility.options')}
          padding
          onPress={() => onMenuPress(item.linkId)}
        >
          <Icon.Feather name="more-vertical" size={20} color={theme.colors.tertiary} />
        </Link>
      </LinkItemContainer>
      <Border className="mx-[20px]" />
    </Box>
  )
}

export default BibleLinkItem
