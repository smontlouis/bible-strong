import styled from '@emotion/native'
import distanceInWords from 'date-fns/formatDistance'
import React from 'react'

import * as Icon from '@expo/vector-icons'

import Link from '~common/Link'
import TagList from '~common/TagList'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import { Theme, useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import Paragraph from '~common/ui/Paragraph'
import truncate from '~helpers/truncate'
import useLanguage from '~helpers/useLanguage'
import { getDateLocale } from '~helpers/languageUtils'
import { FeatherIcon } from '~common/ui/Icon'
import { Link as LinkType } from '~redux/modules/user'
import { linkTypeConfig } from '~helpers/fetchOpenGraphData'

const LinkItemContainer = styled(Link)(({ theme }: { theme: Theme }) => ({
  paddingVertical: 20,
  padding: 20,
  paddingRight: 0,
  flexDirection: 'row',
}))

const LinkTypeIcon = styled(Box)<{ bgColor: string }>(({ bgColor }) => ({
  width: 24,
  height: 24,
  borderRadius: 4,
  backgroundColor: bgColor,
  marginRight: 10,
  alignItems: 'center',
  justifyContent: 'center',
}))

type TLink = {
  linkId: string
  reference: string
  link: LinkType
}

type Props = {
  item: TLink
  onPress: (linkId: string) => void
  onMenuPress: (linkId: string) => void
}

const BibleLinkItem = ({ item, onPress, onMenuPress }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const lang = useLanguage()

  const formattedDate = distanceInWords(Number(item.link.date), Date.now(), {
    locale: getDateLocale(lang),
  })

  const config = linkTypeConfig[item.link.linkType] || linkTypeConfig.website
  const displayTitle = item.link.customTitle || item.link.ogData?.title || item.link.url

  return (
    <Box>
      <LinkItemContainer onPress={() => onPress(item.linkId)}>
        <LinkTypeIcon bgColor={config.color}>
          {config.textIcon ? (
            <Text bold fontSize={12} color="white">
              {config.textIcon}
            </Text>
          ) : (
            <FeatherIcon name={config.icon as any} size={14} color="white" />
          )}
        </LinkTypeIcon>
        <Box flex>
          <Box row justifyContent="space-between">
            <Text color="darkGrey" bold fontSize={11}>
              {item.reference} - {t('Il y a {{formattedDate}}', { formattedDate })}
            </Text>
          </Box>
          {/* @ts-ignore */}
          <Text title fontSize={16} scale={-2}>
            {truncate(displayTitle, 50)}
          </Text>
          <Paragraph scale={-3} scaleLineHeight={-1} color="tertiary" numberOfLines={1}>
            {item.link.url}
          </Paragraph>
          {item.link.tags && Object.keys(item.link.tags).length > 0 && (
            <TagList tags={item.link.tags} />
          )}
        </Box>
        <Link padding onPress={() => onMenuPress(item.linkId)}>
          <Icon.Feather name="more-vertical" size={20} color={theme.colors.tertiary} />
        </Link>
      </LinkItemContainer>
      <Border marginHorizontal={20} />
    </Box>
  )
}

export default BibleLinkItem
