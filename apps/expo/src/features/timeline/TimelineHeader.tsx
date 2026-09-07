import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import * as Icon from '@expo/vector-icons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import { MenuView } from '~common/ui/MenuView'
import PageContent from '~common/ui/PageContent'
import type { Theme as AppTheme } from '~themes'

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Back from '~common/Back'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import useLanguage from '~helpers/useLanguage'

const HeaderBox = (
  componentProps: Omit<UIComponentProps<typeof Box>, keyof { topInset: number } | 'theme'> &
    Omit<{ topInset: number }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { topInset } = props
  const classStyles = useResolveClassNames(
    twMerge(
      'absolute top-[0px] left-[0px] right-[0px] h-[54px] border-b-border items-stretch z-[1]',
      className
    )
  )
  return (
    <Box
      {...props}
      style={
        [classStyles, { marginTop: topInset }, props.style] as UIComponentProps<typeof Box>['style']
      }
      className="overflow-hidden border-continuous"
    />
  )
}

const FeatherIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('text-default', className))
  return (
    <Icon.Feather
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Icon.Feather>['style']}
    />
  )
}

interface Props {
  title: string
  titleEn: string
  fontSize?: number
  hasBackButton?: boolean
  isFormSheet?: boolean
  onPress: () => void
  onBackPress?: () => void
  onOpenInNewTab: () => void
  onSearchPress: () => void
}

const TimelineHeader = ({
  title,
  titleEn,
  fontSize = 14,
  hasBackButton,
  isFormSheet = false,
  onPress,
  onBackPress,
  onOpenInNewTab,
  onSearchPress,
}: Props) => {
  const stylingTheme = useStylingTheme()

  const lang = useLanguage()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const topInset = isFormSheet ? 0 : insets.top

  return (
    <HeaderBox topInset={topInset}>
      <PageContent className="flex-[1] flex-row">
        <Box className="overflow-hidden border-continuous items-center justify-center">
          {hasBackButton && (
            <Back padding onCustomPress={onBackPress}>
              <FeatherIcon name="arrow-left" size={20} />
            </Back>
          )}
        </Box>
        <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center">
          <Text
            style={{
              fontSize: fontSize || 14,
              fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
            }}
          >
            {getLegacyLocalizedField(lang, { fr: title, en: titleEn })}
          </Text>
        </Box>
        <Box className="overflow-hidden border-continuous items-center justify-center flex-row">
          <TouchableBox
            className="overflow-hidden border-continuous items-center justify-center h-[54px] w-[44px]"
            onPress={onSearchPress}
            accessibilityRole="button"
            accessibilityLabel={t('Recherche')}
          >
            <FeatherIcon name="search" size={19} />
          </TouchableBox>
          <MenuView
            actions={[
              { id: 'details', title: t('Détails'), image: 'info.circle' },
              {
                id: 'open-tab',
                title: t('tab.openInNewTab'),
                image: 'arrow.up.forward.square',
              },
            ]}
            onPressAction={({ nativeEvent }) => {
              switch (nativeEvent.event) {
                case 'details':
                  onPress()
                  break
                case 'open-tab':
                  onOpenInNewTab()
                  break
              }
            }}
          >
            <Box className="overflow-hidden border-continuous flex-row items-center justify-center h-[54px] w-[44px]">
              <Icon.Feather name="more-vertical" size={18} />
            </Box>
          </MenuView>
        </Box>
      </PageContent>
    </HeaderBox>
  )
}

export default TimelineHeader
