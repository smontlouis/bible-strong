import React from 'react'
import * as Icon from '@expo/vector-icons'
import { TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
  renderers
} from 'react-native-popup-menu'

import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import BackgroundIcon from '~assets/images/BackgroundIcon'
import ColorIcon from '~assets/images/ColorIcon'
import QuoteIcon from '~assets/images/QuoteIcon'

const { Popover } = renderers

const TouchableIcon = styled(TouchableOpacity)(() => ({
  borderRadius: 2,
  marginHorizontal: 10
}))

const PopOverMenu = ({ element, popover }) => (
  <Menu renderer={Popover} rendererProps={{ placement: 'top' }}>
    <MenuTrigger>{element}</MenuTrigger>
    <MenuOptions
      optionsContainerStyle={{
        shadowColor: 'rgb(89,131,240)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 7,
        elevation: 1,
        borderRadius: 8
      }}>
      <Box padding={10}>{popover}</Box>
    </MenuOptions>
  </Menu>
)

const SelectHeading = ({ dispatchToWebView, activeFormats }) => {
  const headings = [
    { label: 'Normal', value: 0 },
    { label: 'Titre', value: 1 },
    { label: 'Sous-titre', value: 2 }
  ]

  const headerTitle = {
    0: 'Normal',
    1: 'Titre',
    2: 'Sous-titre'
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
          paddingVertical={5}
          paddingHorizontal={5}>
          <Text fontSize={13} bold color="primary">
            {getHeaderTitle()}
          </Text>
          <Box
            marginLeft={5}
            rounded
            backgroundColor="primary"
            width={18}
            height={18}
            center>
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
              value: h.value
            })
          }}>
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
            }>
            {h.label}
          </Text>
        </MenuOption>
      ))}
    />
  )
}

const SelectMore = ({ dispatchToWebView, activeFormats }) => {
  const openColorModal = v => console.log(v)

  return (
    <PopOverMenu
      element={<FeatherIcon name="more-horizontal" size={18} />}
      popover={
        <Box>
          <Box row>
            <TouchableIcon onPress={() => openColorModal('background')}>
              <BackgroundIcon color={activeFormats.background} />
            </TouchableIcon>
            <TouchableIcon onPress={() => openColorModal('color')}>
              <ColorIcon color={activeFormats.color} />
            </TouchableIcon>
            <TouchableIcon
              underlayColor="rgba(0,0,0,0.25)"
              onPress={() =>
                dispatchToWebView('TOGGLE_FORMAT', {
                  type: 'BLOCKQUOTE',
                  value: !activeFormats.blockquote
                })
              }>
              <QuoteIcon
                color={activeFormats.blockquote ? 'primary' : 'default'}
              />
            </TouchableIcon>
          </Box>
          <Border marginTop={10} />
          <Box row marginTop={10}>
            <TouchableIcon
              onPress={() =>
                dispatchToWebView('TOGGLE_FORMAT', {
                  type: 'LIST',
                  value: activeFormats.list === 'bullet' ? false : 'bullet'
                })
              }>
              <FormatIcon
                isSelected={activeFormats.list === 'bullet'}
                name="list"
                size={20}
              />
            </TouchableIcon>
            <TouchableIcon
              onPress={() =>
                dispatchToWebView('TOGGLE_FORMAT', {
                  type: 'LIST',
                  value: activeFormats.list === 'ordered' ? false : 'ordered'
                })
              }>
              <MaterialFormatIcon
                isSelected={activeFormats.list === 'ordered'}
                name="format-list-numbered"
                size={20}
              />
            </TouchableIcon>
            <TouchableIcon
              onPress={() => {
                dispatchToWebView('BLOCK_DIVIDER')
              }}>
              <FeatherIcon size={20} name="minus" />
            </TouchableIcon>
          </Box>
          <Border marginTop={10} />
          <Box row marginTop={10}>
            <TouchableIcon
              onPress={() =>
                dispatchToWebView('TOGGLE_FORMAT', { type: 'UNDO' })
              }>
              <MaterialIcon name="undo" size={20} />
            </TouchableIcon>
            <TouchableIcon
              onPress={() =>
                dispatchToWebView('TOGGLE_FORMAT', { type: 'REDO' })
              }>
              <MaterialIcon name="redo" size={20} />
            </TouchableIcon>
          </Box>
        </Box>
      }
    />
  )
}

const SelectBlock = ({ navigateBibleView }) => {
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
              <Text>Insérer un lien de verset</Text>
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
              <Text>Insérer un texte de verset</Text>
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
              <Text>Insérer un lien de strong</Text>
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
              <Text>Insérer un texte de strong</Text>
            </Box>
          </MenuOption>
        </>
      }
    />
  )
}

const FormatIcon = styled(Icon.Feather)(({ theme, isSelected }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  width: 25,
  height: 25,
  alignItems: 'center',
  justifyContent: 'center'
}))

const MaterialFormatIcon = FormatIcon.withComponent(Icon.MaterialIcons)

const StudyFooter = ({
  dispatchToWebView,
  navigateBibleView,
  activeFormats
}) => {
  return (
    <Box row height={40} backgroundColor="#F9F9F9">
      <Box
        row
        flex
        alignItems="center"
        justifyContent="flex-start"
        paddingLeft={10}>
        <SelectHeading
          dispatchToWebView={dispatchToWebView}
          activeFormats={activeFormats}
        />
        <FormatIcon
          isSelected={activeFormats.bold}
          name="bold"
          size={16}
          onPress={() =>
            dispatchToWebView('TOGGLE_FORMAT', {
              type: 'BOLD',
              value: !activeFormats.bold
            })
          }
          style={{ marginLeft: 10, marginRight: 15, width: 16, height: 16 }}
        />
        <FormatIcon
          isSelected={activeFormats.italic}
          name="italic"
          size={16}
          onPress={() =>
            dispatchToWebView('TOGGLE_FORMAT', {
              type: 'ITALIC',
              value: !activeFormats.italic
            })
          }
          style={{ marginRight: 15, width: 16, height: 16 }}
        />
        <FormatIcon
          isSelected={activeFormats.underline}
          name="underline"
          size={16}
          onPress={() =>
            dispatchToWebView('TOGGLE_FORMAT', {
              type: 'UNDERLINE',
              value: !activeFormats.underline
            })
          }
          style={{ marginRight: 15, width: 16, height: 16 }}
        />
        <SelectMore
          dispatchToWebView={dispatchToWebView}
          activeFormats={activeFormats}
        />
        <Box marginLeft="auto" />
        <SelectBlock navigateBibleView={navigateBibleView} />
      </Box>
      <Link onPress={() => dispatchToWebView('BLUR_EDITOR')} paddingSmall>
        <MaterialIcon name="keyboard-hide" size={20} color="grey" />
      </Link>
    </Box>
  )
}

export default StudyFooter
