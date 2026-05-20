import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import BottomSheet from '@gorhom/bottom-sheet'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Back from '~common/Back'
import PopOverMenu from '~common/PopOverMenu'
import Box from '~common/ui/Box'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'

const HeaderBox = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 60,
  marginTop: useSafeAreaInsets().top,
  borderBottomColor: theme.colors.border,
  alignItems: 'stretch',
  zIndex: 1,
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

interface Props {
  title: string
  titleEn: string
  fontSize?: number
  hasBackButton?: boolean
  onPress: () => void
  onBackPress?: () => void
  onOpenInNewTab: () => void
  searchModalRef: React.RefObject<BottomSheet | null>
}

const TimelineHeader = ({
  title,
  titleEn,
  fontSize = 20,
  hasBackButton,
  onPress,
  onBackPress,
  onOpenInNewTab,
  searchModalRef,
}: Props) => {
  const lang = useLanguage()
  const { t } = useTranslation()

  const openSearch = () => {
    searchModalRef.current?.expand()
  }

  return (
    <HeaderBox row>
      <Box center>
        {hasBackButton && (
          <Back padding onCustomPress={onBackPress}>
            <FeatherIcon name={'grid'} size={20} />
          </Back>
        )}
      </Box>
      <Box flex center>
        <Text title fontSize={fontSize}>
          {getLegacyLocalizedField(lang, { fr: title, en: titleEn })}
        </Text>
      </Box>
      <Box center row>
        <PopOverMenu
          popover={
            <>
              <MenuOption onSelect={openSearch}>
                <Box row alignItems="center">
                  <FeatherIcon name="search" size={15} />
                  <Text marginLeft={10}>{t('Recherche')}</Text>
                </Box>
              </MenuOption>
              <MenuOption onSelect={onPress}>
                <Box row alignItems="center">
                  <FeatherIcon name="info" size={15} />
                  <Text marginLeft={10}>{t('Détails')}</Text>
                </Box>
              </MenuOption>
              <MenuOption onSelect={onOpenInNewTab}>
                <Box row alignItems="center">
                  <FeatherIcon name="external-link" size={15} />
                  <Text marginLeft={10}>{t('tab.openInNewTab')}</Text>
                </Box>
              </MenuOption>
            </>
          }
        />
      </Box>
    </HeaderBox>
  )
}

export default TimelineHeader
