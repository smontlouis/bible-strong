import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import Color from 'color'
import React from 'react'
import { TouchableOpacity } from 'react-native'
import {
  Menu,
  MenuOption,
  MenuOptions,
  MenuTrigger,
  renderers,
  withMenuContext,
} from 'react-native-popup-menu'

import { useTranslation } from 'react-i18next'
import BackgroundIcon from '~assets/images/BackgroundIcon'
import ColorIcon from '~assets/images/ColorIcon'
import QuoteIcon from '~assets/images/QuoteIcon'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import TouchableCircle from '~features/bible/TouchableCircle'
import useMediaQueries from '~helpers/useMediaQueries'

const { Popover } = renderers

const TouchableIcon = styled(TouchableOpacity)(() => ({
  borderRadius: 2,
  marginHorizontal: 10,
}))

const PopOverMenu = ({ element, popover, ...props }) => (
  <Menu renderer={Popover} rendererProps={{ placement: 'top' }} {...props}>
    <MenuTrigger>{element}</MenuTrigger>
    <MenuOptions
      optionsContainerStyle={{
        backgroundColor: 'white',
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

const SelectHeading = ({ dispatchToWebView, activeFormats }) => {
  const { t } = useTranslation()
  const headings = [
    { label: 'Normal', value: 0 },
    { label: 'Titre', value: 1 },
    { label: 'Sous-titre', value: 2 },
  ]

  const headerTitle = {
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
          <Box
            marginLeft={5}
            rounded
            backgroundColor="primary"
            width={18}
            height={18}
            center
          >
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

const colors = [
  '#cc0000',
  '#f1c232',
  '#6aa84f',
  '#45818e',
  '#3d85c6',
  '#674ea7',
  '#a64d79',
]
const lighten = ['0.3', '0.5', '0.7', '0.9']

const SelectMore = ({ dispatchToWebView, activeFormats, ctx }) => {
  const [colorModal, setOpenColorModal] = React.useState()

  const setColor = color => {
    dispatchToWebView('TOGGLE_FORMAT', {
      type: colorModal === 'background' ? 'BACKGROUND' : 'COLOR',
      value: color,
    })
  }

  return (
    <PopOverMenu
      onClose={() => setOpenColorModal()}
      element={<FeatherIcon name="more-horizontal" size={18} color="primary" />}
      popover={
        colorModal ? (
          <Box width={200}>
            {lighten.map(l => (
              <Box key={l} row marginBottom={l === '0.9' ? 0 : 10}>
                {colors.map(c => (
                  <TouchableCircle
                    key={c}
                    size={20}
                    color={Color(c)
                      .lighten(l)
                      .string()}
                    onPress={() => {
                      setColor(
                        Color(c)
                          .lighten(l)
                          .string()
                      )
                      ctx.menuActions.closeMenu()
                    }}
                  />
                ))}
              </Box>
            ))}
          </Box>
        ) : (
          <Box>
            <Box row>
              <FormatIcon
                isSelected={activeFormats.background}
                style={{ marginHorizontal: 10 }}
                onPress={() => setOpenColorModal('background')}
              >
                <BackgroundIcon color={activeFormats.background} />
              </FormatIcon>
              <FormatIcon
                isSelected={activeFormats.color}
                style={{ marginHorizontal: 10 }}
                onPress={() => setOpenColorModal('color')}
              >
                <ColorIcon color={activeFormats.color} />
              </FormatIcon>
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
                <MaterialIcon
                  color="primary"
                  name="format-list-numbered"
                  size={20}
                />
              </FormatIcon>
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
              <TouchableIcon
                onPress={() =>
                  dispatchToWebView('TOGGLE_FORMAT', { type: 'UNDO' })
                }
              >
                <MaterialIcon name="undo" size={20} color="primary" />
              </TouchableIcon>
              <TouchableIcon
                onPress={() =>
                  dispatchToWebView('TOGGLE_FORMAT', { type: 'REDO' })
                }
              >
                <MaterialIcon name="redo" size={20} color="primary" />
              </TouchableIcon>
            </Box>
          </Box>
        )
      }
    />
  )
}

const SelectBlock = ({ navigateBibleView }) => {
  const { t } = useTranslation()
  return (
    <PopOverMenu
      element={
        <MaterialIcon
          name="add-box"
          size={22}
          color="primary"
          style={{ marginLeft: 'auto' }}
        />
      }
      popover={
        <>
          <MenuOption onSelect={() => navigateBibleView('verse')}>
            <Box row alignItems="center">
              <FeatherIcon
                color="quint"
                size={20}
                name="link-2"
                style={{ marginRight: 15 }}
              />
              <Text>{t('Insérer un lien de verset')}</Text>
            </Box>
          </MenuOption>
          <MenuOption onSelect={() => navigateBibleView('verse-block')}>
            <Box row alignItems="center">
              <MaterialIcon
                color="quint"
                size={24}
                name="short-text"
                style={{ marginRight: 15 }}
              />
              <Text>{t('Insérer un texte de verset')}</Text>
            </Box>
          </MenuOption>
          <MenuOption onSelect={() => navigateBibleView('strong')}>
            <Box row alignItems="center">
              <FeatherIcon
                color="primary"
                size={20}
                name="link-2"
                style={{ marginRight: 15 }}
              />
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

const FormatIcon = styled(TouchableOpacity)(({ theme, isSelected }) => ({
  width: 25,
  height: 25,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: isSelected ? theme.colors.lightPrimary : 'transparent',
}))

const FormatIconForPopover = FormatIcon.withComponent(Box)

const ColorPopover = ({ type, setColor, ctx }) => (
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
    {lighten.map(l => (
      <Box key={l} row marginBottom={l === '0.9' ? 0 : 10}>
        {colors.map(c => (
          <TouchableCircle
            key={c}
            size={20}
            color={Color(c)
              .lighten(l)
              .string()}
            onPress={() => {
              setColor(
                type,
                Color(c)
                  .lighten(l)
                  .string()
              )
              ctx.menuActions.closeMenu()
            }}
          />
        ))}
      </Box>
    ))}
  </Box>
)

const StudyFooter = ({
  dispatchToWebView,
  navigateBibleView,
  openBibleView,
  activeFormats,
  ctx,
}) => {
  const deviceSize = useMediaQueries()

  const setColor = (colorModal, color) => {
    dispatchToWebView('TOGGLE_FORMAT', {
      type: colorModal === 'background' ? 'BACKGROUND' : 'COLOR',
      value: color,
    })
  }

  return (
    <Box row height={50} backgroundColor="#F9F9F9" alignItems="center">
      <Box row flex center paddingLeft={10}>
        <SelectHeading
          dispatchToWebView={dispatchToWebView}
          activeFormats={activeFormats}
        />
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
              popover={
                <ColorPopover type="background" ctx={ctx} setColor={setColor} />
              }
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
              popover={
                <ColorPopover type="color" ctx={ctx} setColor={setColor} />
              }
            />
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
              <MaterialIcon
                color="primary"
                name="format-list-numbered"
                size={20}
              />
            </FormatIcon>
            <FormatIcon
              style={{ marginHorizontal: 10 }}
              onPress={() => {
                dispatchToWebView('BLOCK_DIVIDER')
              }}
            >
              <FeatherIcon size={20} name="minus" color="primary" />
            </FormatIcon>
            <TouchableIcon
              onPress={() =>
                dispatchToWebView('TOGGLE_FORMAT', { type: 'UNDO' })
              }
            >
              <MaterialIcon name="undo" size={20} color="primary" />
            </TouchableIcon>
            <TouchableIcon
              onPress={() =>
                dispatchToWebView('TOGGLE_FORMAT', { type: 'REDO' })
              }
            >
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
}

export default withMenuContext(StudyFooter)
