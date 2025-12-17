import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import Color from 'color'
import React, { memo } from 'react'
import { TouchableOpacity } from 'react-native'
import { Menu, MenuOptions, MenuTrigger, renderers, withMenuContext } from 'react-native-popup-menu'

import { useTranslation } from 'react-i18next'
import BackgroundIcon from '~assets/images/BackgroundIcon'
import ColorIcon from '~assets/images/ColorIcon'
import QuoteIcon from '~assets/images/QuoteIcon'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box, { TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import TouchableCircle from '~features/bible/TouchableCircle'
import useMediaQueries from '~helpers/useMediaQueries'
import { MenuOption as BaseMenuOption, MenuOptionProps } from 'react-native-popup-menu'
import { useTheme } from '@emotion/react'

const { Popover } = renderers

const TouchableIcon = styled(TouchableOpacity)(() => ({
  borderRadius: 2,
  marginHorizontal: 10,
}))

const PopOverMenu = ({ element, popover, ...props }: any) => {
  const theme = useTheme()
  return (
    <Menu renderer={Popover} rendererProps={{ placement: 'top' }} {...props}>
      <MenuTrigger>{element}</MenuTrigger>
      <MenuOptions
        optionsContainerStyle={{
          backgroundColor: theme.colors.reverse,
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          borderRadius: 8,
        }}
      >
        <Box padding={10}>{popover}</Box>
      </MenuOptions>
    </Menu>
  )
}

// For whatever reason, we cannot use react-native-popover-view here, so we use react-native-popup-menu instead
const MenuOption = (props: MenuOptionProps) => {
  return (
    <BaseMenuOption
      {...props}
      customStyles={{
        optionWrapper: {
          paddingHorizontal: 10,
        },
      }}
    />
  )
}

const SelectHeading = ({ dispatchToWebView, activeFormats }: any) => {
  const { t } = useTranslation()
  const headings = [
    { label: 'Normal', value: 0 },
    { label: 'Titre', value: 1 },
    { label: 'Sous-titre', value: 2 },
  ]

  const headerTitle: any = {
    0: 'Normal',
    1: 'Titre',
    2: 'Sous-titre',
  }

  const getHeaderTitle = () => {
    if (!activeFormats.header) {
      return headerTitle[0]
    }
    return headerTitle[activeFormats.header]
  }

  return (
    <PopOverMenu
      element={
        <Box
          row
          center
          borderRadius={20}
          backgroundColor="lightPrimary"
          paddingVertical={4}
          paddingHorizontal={7}
        >
          <Text fontSize={15} bold color="primary">
            {t(getHeaderTitle())}
          </Text>
          <Box marginLeft={5} rounded backgroundColor="primary" width={18} height={18} center>
            <FeatherIcon name="chevron-up" color="reverse" size={18} />
          </Box>
        </Box>
      }
      popover={headings.map(h => (
        <MenuOption
          key={h.label}
          onSelect={() => {
            dispatchToWebView('TOGGLE_FORMAT', {
              type: 'HEADER',
              value: h.value,
            })
          }}
        >
          <Text
            fontSize={14}
            bold
            color={
              activeFormats.header
                ? activeFormats.header === h.value
                  ? 'primary'
                  : 'grey'
                : h.value === 0
                  ? 'primary'
                  : 'grey'
            }
          >
            {t(h.label)}
          </Text>
        </MenuOption>
      ))}
    />
  )
}

const colors = ['#cc0000', '#f1c232', '#6aa84f', '#45818e', '#3d85c6', '#674ea7', '#a64d79']
const lighten = ['0.3', '0.5', '0.7', '0.9']

const SelectMore = ({ dispatchToWebView, activeFormats, ctx }: any) => {
  const [colorModal, setOpenColorModal] = React.useState<any>()
  const { t } = useTranslation()

  const setColor = (color: any) => {
    dispatchToWebView('TOGGLE_FORMAT', {
      type: colorModal === 'background' ? 'BACKGROUND' : 'COLOR',
      value: color,
    })
  }

  return (
    <PopOverMenu
      onClose={() => setOpenColorModal(undefined)}
      element={<FeatherIcon name="more-horizontal" size={18} color="primary" />}
      popover={
        colorModal ? (
          <VStack width={200} gap={12}>
            <TouchableBox
              onPress={() => {
                setColor(null)
                ctx.menuActions.closeMenu()
              }}
              bg="lightGrey"
              px={10}
              py={5}
              rounded
            >
              <Text textAlign="center" fontSize={12}>
                {t('reset')}
              </Text>
            </TouchableBox>
            {lighten.map((l: any) => (
              <Box key={l} row marginBottom={l === '0.9' ? 0 : 10}>
                {colors.map((c: any) => (
                  <TouchableCircle
                    key={c}
                    size={20}
                    color={Color(c).lighten(Number(l)).string()}
                    onPress={() => {
                      setColor(Color(c).lighten(Number(l)).string())
                      ctx.menuActions.closeMenu()
                    }}
                  />
                ))}
              </Box>
            ))}
          </VStack>
        ) : (
          <Box>
            <Box row>
              {/* @ts-ignore */}
              <FormatIcon
                isSelected={activeFormats.background}
                style={{ marginHorizontal: 10 }}
                onPress={() => setOpenColorModal('background')}
              >
                <BackgroundIcon color={activeFormats.background} />
              </FormatIcon>
              {/* @ts-ignore */}
              <FormatIcon
                isSelected={activeFormats.color}
                style={{ marginHorizontal: 10 }}
                onPress={() => setOpenColorModal('color')}
              >
                <ColorIcon color={activeFormats.color} />
              </FormatIcon>
              {/* @ts-ignore */}
              <FormatIcon
                isSelected={activeFormats.blockquote}
                style={{ marginHorizontal: 10 }}
                onPress={() =>
                  dispatchToWebView('TOGGLE_FORMAT', {
                    type: 'BLOCKQUOTE',
                    value: !activeFormats.blockquote,
                  })
                }
              >
                <QuoteIcon color="primary" />
              </FormatIcon>
            </Box>
            <Border marginTop={10} />
            <Box row marginTop={10}>
              {/* @ts-ignore */}
              <FormatIcon
                isSelected={activeFormats.list === 'bullet'}
                style={{ marginHorizontal: 10 }}
                onPress={() =>
                  dispatchToWebView('TOGGLE_FORMAT', {
                    type: 'LIST',
                    value: activeFormats.list === 'bullet' ? false : 'bullet',
                  })
                }
              >
                <FeatherIcon color="primary" name="list" size={20} />
              </FormatIcon>
              {/* @ts-ignore */}
              <FormatIcon
                isSelected={activeFormats.list === 'ordered'}
                style={{ marginHorizontal: 10 }}
                onPress={() =>
                  dispatchToWebView('TOGGLE_FORMAT', {
                    type: 'LIST',
                    value: activeFormats.list === 'ordered' ? false : 'ordered',
                  })
                }
              >
                <MaterialIcon color="primary" name="format-list-numbered" size={20} />
              </FormatIcon>
              {/* @ts-ignore */}
              <FormatIcon
                style={{ marginHorizontal: 10 }}
                onPress={() => {
                  dispatchToWebView('BLOCK_DIVIDER')
                }}
              >
                <FeatherIcon size={20} name="minus" color="primary" />
              </FormatIcon>
            </Box>
            <Border marginTop={10} />
            <Box row marginTop={10}>
              <TouchableIcon onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'UNDO' })}>
                <MaterialIcon name="undo" size={20} color="primary" />
              </TouchableIcon>
              <TouchableIcon onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'REDO' })}>
                <MaterialIcon name="redo" size={20} color="primary" />
              </TouchableIcon>
            </Box>
          </Box>
        )
      }
    />
  )
}

const SelectBlock = ({ navigateBibleView }: any) => {
  const { t } = useTranslation()
  return (
    <PopOverMenu
      element={
        <MaterialIcon name="add-box" size={22} color="primary" style={{ marginLeft: 'auto' }} />
      }
      popover={
        <>
          <MenuOption onSelect={() => navigateBibleView('verse')}>
            <Box row alignItems="center">
              <FeatherIcon color="quint" size={20} name="link-2" style={{ marginRight: 15 }} />
              <Text>{t('Insérer un lien de verset')}</Text>
            </Box>
          </MenuOption>
          <MenuOption onSelect={() => navigateBibleView('verse-block')}>
            <Box row alignItems="center">
              <MaterialIcon color="quint" size={24} name="short-text" style={{ marginRight: 15 }} />
              <Text>{t('Insérer un texte de verset')}</Text>
            </Box>
          </MenuOption>
          <MenuOption onSelect={() => navigateBibleView('strong')}>
            <Box row alignItems="center">
              <FeatherIcon color="primary" size={20} name="link-2" style={{ marginRight: 15 }} />
              <Text>{t('Insérer un lien de strong')}</Text>
            </Box>
          </MenuOption>
          <MenuOption onSelect={() => navigateBibleView('strong-block')}>
            <Box row alignItems="center">
              <MaterialIcon
                color="primary"
                size={24}
                name="short-text"
                style={{ marginRight: 15 }}
              />
              <Text>{t('Insérer un texte de strong')}</Text>
            </Box>
          </MenuOption>
        </>
      }
    />
  )
}

const FormatIcon = styled(TouchableOpacity)(({ theme, isSelected }: any) => ({
  width: 25,
  height: 25,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: isSelected ? theme.colors.lightPrimary : 'transparent',
}))

const FormatIconForPopover = FormatIcon.withComponent(Box)

const ColorPopover = ({ type, setColor, ctx }: any) => (
  <Box width={200}>
    <Box row marginBottom={15} padding={5} alignItems="center">
      <Icon.Feather
        onPress={() => {
          setColor(type, false)
          ctx.menuActions.closeMenu()
        }}
        name="x-circle"
        size={23}
        style={{ marginRight: 10 }}
      />
      <Text
        onPress={() => {
          setColor(type, false)
          ctx.menuActions.closeMenu()
        }}
        fontSize={18}
      >
        Aucune
      </Text>
    </Box>
    {lighten.map((l: any) => (
      <Box key={l} row marginBottom={l === '0.9' ? 0 : 10}>
        {colors.map((c: any) => (
          <TouchableCircle
            key={c}
            size={20}
            color={Color(c).lighten(Number(l)).string()}
            onPress={() => {
              setColor(type, Color(c).lighten(Number(l)).string())
              ctx.menuActions.closeMenu()
            }}
          />
        ))}
      </Box>
    ))}
  </Box>
)

const StudyFooter = memo(
  ({ dispatchToWebView, navigateBibleView, activeFormats, ctx }: any) => {
    const deviceSize = useMediaQueries()

    const setColor = (colorModal: any, color: any) => {
      dispatchToWebView('TOGGLE_FORMAT', {
        type: colorModal === 'background' ? 'BACKGROUND' : 'COLOR',
        value: color,
      })
    }

    return (
      <Box row height={50} backgroundColor="reverse" alignItems="center">
        <Box row flex center paddingLeft={10}>
          <SelectHeading dispatchToWebView={dispatchToWebView} activeFormats={activeFormats} />
          {/* @ts-ignore */}
          <FormatIcon
            isSelected={activeFormats.bold}
            onPress={() =>
              dispatchToWebView('TOGGLE_FORMAT', {
                type: 'BOLD',
                value: !activeFormats.bold,
              })
            }
            style={{ marginLeft: 10, marginRight: 10 }}
          >
            <FeatherIcon color="primary" name="bold" size={16} />
          </FormatIcon>
          {/* @ts-ignore */}
          <FormatIcon
            isSelected={activeFormats.italic}
            onPress={() =>
              dispatchToWebView('TOGGLE_FORMAT', {
                type: 'ITALIC',
                value: !activeFormats.italic,
              })
            }
            style={{ marginRight: 10 }}
          >
            <FeatherIcon color="primary" name="italic" size={16} />
          </FormatIcon>
          {/* @ts-ignore */}
          <FormatIcon
            isSelected={activeFormats.underline}
            onPress={() =>
              dispatchToWebView('TOGGLE_FORMAT', {
                type: 'UNDERLINE',
                value: !activeFormats.underline,
              })
            }
            style={{ marginRight: 10 }}
          >
            <FeatherIcon color="primary" name="underline" size={16} />
          </FormatIcon>
          {deviceSize === 'xs' || deviceSize === 'sm' ? (
            <SelectMore
              dispatchToWebView={dispatchToWebView}
              activeFormats={activeFormats}
              ctx={ctx}
            />
          ) : (
            <>
              <PopOverMenu
                element={
                  <FormatIconForPopover
                    isSelected={activeFormats.background}
                    style={{ marginHorizontal: 10 }}
                  >
                    <BackgroundIcon color={activeFormats.background} />
                  </FormatIconForPopover>
                }
                popover={<ColorPopover type="background" ctx={ctx} setColor={setColor} />}
              />
              <PopOverMenu
                element={
                  <FormatIconForPopover
                    isSelected={activeFormats.color}
                    style={{ marginHorizontal: 10 }}
                  >
                    <ColorIcon color={activeFormats.color} />
                  </FormatIconForPopover>
                }
                popover={<ColorPopover type="color" ctx={ctx} setColor={setColor} />}
              />
              {/* @ts-ignore */}
              <FormatIcon
                isSelected={activeFormats.blockquote}
                style={{ marginHorizontal: 10 }}
                onPress={() =>
                  dispatchToWebView('TOGGLE_FORMAT', {
                    type: 'BLOCKQUOTE',
                    value: !activeFormats.blockquote,
                  })
                }
              >
                <QuoteIcon color="primary" />
              </FormatIcon>
              {/* @ts-ignore */}
              <FormatIcon
                isSelected={activeFormats.list === 'bullet'}
                style={{ marginHorizontal: 10 }}
                onPress={() =>
                  dispatchToWebView('TOGGLE_FORMAT', {
                    type: 'LIST',
                    value: activeFormats.list === 'bullet' ? false : 'bullet',
                  })
                }
              >
                <FeatherIcon color="primary" name="list" size={20} />
              </FormatIcon>
              {/* @ts-ignore */}
              <FormatIcon
                isSelected={activeFormats.list === 'ordered'}
                style={{ marginHorizontal: 10 }}
                onPress={() =>
                  dispatchToWebView('TOGGLE_FORMAT', {
                    type: 'LIST',
                    value: activeFormats.list === 'ordered' ? false : 'ordered',
                  })
                }
              >
                <MaterialIcon color="primary" name="format-list-numbered" size={20} />
              </FormatIcon>
              {/* @ts-ignore */}
              <FormatIcon
                style={{ marginHorizontal: 10 }}
                onPress={() => {
                  dispatchToWebView('BLOCK_DIVIDER')
                }}
              >
                <FeatherIcon size={20} name="minus" color="primary" />
              </FormatIcon>
              <TouchableIcon onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'UNDO' })}>
                <MaterialIcon name="undo" size={20} color="primary" />
              </TouchableIcon>
              <TouchableIcon onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'REDO' })}>
                <MaterialIcon name="redo" size={20} color="primary" />
              </TouchableIcon>
            </>
          )}
          <Box marginLeft="auto" />
          <SelectBlock navigateBibleView={navigateBibleView} />
        </Box>
        <Link paddingSmall onPress={() => dispatchToWebView('BLUR_EDITOR')}>
          <MaterialIcon name="keyboard-hide" size={20} color="primary" />
        </Link>
      </Box>
    )
  },
  (prevProps, nextProps) => {
    return JSON.stringify(prevProps.activeFormats) === JSON.stringify(nextProps.activeFormats)
  }
)

export default withMenuContext(StudyFooter)
