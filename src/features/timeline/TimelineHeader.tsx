import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import BottomSheet from '@gorhom/bottom-sheet'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ActionMenuOption } from '~common/ActionMenu'
import Back from '~common/Back'
import PopOverMenu from '~common/PopOverMenu'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'

const HeaderBox = styled(Box)<{ topInset: number }>(({ theme, topInset }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 60,
  marginTop: topInset,
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
  isFormSheet?: boolean
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
  isFormSheet = false,
  onPress,
  onBackPress,
  onOpenInNewTab,
  searchModalRef,
}: Props) => {
  const lang = useLanguage()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const topInset = isFormSheet ? 0 : insets.top

  const openSearch = () => {
    searchModalRef.current?.expand()
  }

  return (
    <HeaderBox row topInset={topInset}>
      <Box center>
        {hasBackButton && (
          <Back padding onCustomPress={onBackPress}>
            <FeatherIcon name="arrow-left" size={20} />
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
              <ActionMenuOption icon="search" label={t('Recherche')} onSelect={openSearch} />
              <ActionMenuOption icon="info" label={t('Détails')} onSelect={onPress} />
              <ActionMenuOption
                icon="external-link"
                label={t('tab.openInNewTab')}
                onSelect={onOpenInNewTab}
              />
            </>
          }
        />
      </Box>
    </HeaderBox>
  )
}

export default TimelineHeader
