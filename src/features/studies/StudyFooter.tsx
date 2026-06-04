import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { useAtom } from 'jotai/react'
import type { JSONValue } from 'expo/build/dom/dom.types'
import React, { memo, useState } from 'react'
import { TouchableOpacity, useWindowDimensions, type TouchableOpacityProps } from 'react-native'

import { useTranslation } from 'react-i18next'
import type { ColorFormatsObject } from 'reanimated-color-picker'
import BackgroundIcon from '~assets/images/BackgroundIcon'
import ColorIcon from '~assets/images/ColorIcon'
import QuoteIcon from '~assets/images/QuoteIcon'
import { ActionSheetItem } from '~common/ActionMenu'
import ColorPicker from '~common/ColorPicker'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box, { TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import { Sheet } from '~common/sheet'
import Text from '~common/ui/Text'
import { useSheet } from '~helpers/useSheet'
import type { StudyNavigateBibleType } from '~common/types'
import { recentColorsAtom } from './atom'

type DispatchToWebView = (type: string, payload?: JSONValue) => void

type ActiveFormats = {
  header?: 0 | 1 | 2
  background?: string
  color?: string
  blockquote?: boolean
  list?: 'bullet' | 'ordered' | false
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

const useDetachedStudySheetStyle = () => {
  const theme = useTheme()
  const { width: windowWidth } = useWindowDimensions()
  const sheetWidth = Math.min(250, windowWidth - 40)

  return {
    backdrop: false,
    maxWidth: sheetWidth,
    cornerRadius: 16,
    backgroundColor: theme.colors.reverse,
  }
}

const SelectHeading = ({
  dispatchToWebView,
  activeFormats,
  keyboardHeight,
}: {
  dispatchToWebView: DispatchToWebView
  activeFormats: ActiveFormats
  keyboardHeight: number
}) => {
  const { t } = useTranslation()
  const { ref, open, close } = useSheet()
  const detachedSheetStyle = useDetachedStudySheetStyle()
  const headings = [
    { label: 'Normal', value: 0 },
    { label: 'Titre', value: 1 },
    { label: 'Sous-titre', value: 2 },
  ]

  const headerTitle: Record<0 | 1 | 2, string> = {
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
    <>
      <TouchableBox onPress={open}>
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
      </TouchableBox>
      <Sheet
        ref={ref}
        stackBehavior="push"
        detached
        detachedOffset={keyboardHeight}
        {...detachedSheetStyle}
      >
        {headings.map(h => (
          <ActionSheetItem
            key={h.label}
            icon="type"
            label={t(h.label)}
            color={
              activeFormats.header
                ? activeFormats.header === h.value
                  ? 'primary'
                  : 'grey'
                : h.value === 0
                  ? 'primary'
                  : 'grey'
            }
            onPress={() => {
              dispatchToWebView('TOGGLE_FORMAT', {
                type: 'HEADER',
                value: h.value,
              })
              close()
            }}
          />
        ))}
      </Sheet>
    </>
  )
}

const SelectMore = ({
  dispatchToWebView,
  activeFormats,
  keyboardHeight,
}: {
  dispatchToWebView: DispatchToWebView
  activeFormats: ActiveFormats
  keyboardHeight: number
}) => {
  const [colorModal, setOpenColorModal] = useState<'background' | 'color' | undefined>()
  const { t } = useTranslation()
  const { ref, open, close } = useSheet()
  const detachedSheetStyle = useDetachedStudySheetStyle()
  const [recentColors, setRecentColors] = useAtom(recentColorsAtom)
  const defaultColor = colorModal === 'background' ? '#ffffff' : '#000000'
  const currentColor = colorModal === 'background' ? activeFormats.background : activeFormats.color
  const [selectedColor, setSelectedColor] = useState(currentColor || defaultColor)

  // Reset selectedColor when colorModal changes
  React.useEffect(() => {
    if (colorModal) {
      const newDefault = colorModal === 'background' ? '#ffffff' : '#000000'
      const newCurrent =
        colorModal === 'background' ? activeFormats.background : activeFormats.color
      setSelectedColor(newCurrent || newDefault)
    }
  }, [colorModal, activeFormats.background, activeFormats.color])

  const handleColorChange = (color: ColorFormatsObject) => {
    setSelectedColor(color.hex)
  }

  const addToRecentColors = (color: string) => {
    const newColors = [color, ...recentColors.filter(c => c !== color)].slice(0, 5)
    setRecentColors(newColors)
  }

  const handleConfirm = () => {
    dispatchToWebView('TOGGLE_FORMAT', {
      type: colorModal === 'background' ? 'BACKGROUND' : 'COLOR',
      value: selectedColor,
    })
    addToRecentColors(selectedColor)
    close()
  }

  const handleResetColor = () => {
    dispatchToWebView('TOGGLE_FORMAT', {
      type: colorModal === 'background' ? 'BACKGROUND' : 'COLOR',
      value: null,
    })
    close()
  }

  const toggleFormat = (type: string, value?: JSONValue) => {
    dispatchToWebView('TOGGLE_FORMAT', { type, value })
  }

  return (
    <>
      <TouchableBox onPress={open}>
        <Box center width={44} height={50}>
          <FeatherIcon name="more-horizontal" size={18} color="primary" />
        </Box>
      </TouchableBox>
      <Sheet
        ref={ref}
        stackBehavior="push"
        detached
        detachedOffset={keyboardHeight}
        {...detachedSheetStyle}
        onDismiss={() => setOpenColorModal(undefined)}
      >
        {colorModal ? (
          <Box p={20}>
            <TouchableBox onPress={handleResetColor} bg="lightGrey" px={10} py={5} rounded>
              <Text textAlign="center" fontSize={12}>
                {t('reset')}
              </Text>
            </TouchableBox>
            <Box height={280}>
              <ColorPicker
                value={selectedColor}
                onChangeJS={handleColorChange}
                swatchColors={recentColors}
                swatchSize={22}
              />
            </Box>
            <Button small onPress={handleConfirm}>
              {t('Valider')}
            </Button>
          </Box>
        ) : (
          <Box p={20}>
            <Box row center>
              <FormatIcon
                isSelected={Boolean(activeFormats.background)}
                style={{ marginHorizontal: 10 }}
                onPress={() => setOpenColorModal('background')}
              >
                <BackgroundIcon color={activeFormats.background} />
              </FormatIcon>
              <FormatIcon
                isSelected={Boolean(activeFormats.color)}
                style={{ marginHorizontal: 10 }}
                onPress={() => setOpenColorModal('color')}
              >
                <ColorIcon color={activeFormats.color} />
              </FormatIcon>
              <FormatIcon
                isSelected={activeFormats.blockquote}
                style={{ marginHorizontal: 10 }}
                onPress={() => toggleFormat('BLOCKQUOTE', !activeFormats.blockquote)}
              >
                <QuoteIcon color="primary" />
              </FormatIcon>
            </Box>
            <Border marginTop={16} />
            <Box row center marginTop={16}>
              <FormatIcon
                isSelected={activeFormats.list === 'bullet'}
                style={{ marginHorizontal: 10 }}
                onPress={() =>
                  toggleFormat('LIST', activeFormats.list === 'bullet' ? false : 'bullet')
                }
              >
                <FeatherIcon color="primary" name="list" size={20} />
              </FormatIcon>
              <FormatIcon
                isSelected={activeFormats.list === 'ordered'}
                style={{ marginHorizontal: 10 }}
                onPress={() =>
                  toggleFormat('LIST', activeFormats.list === 'ordered' ? false : 'ordered')
                }
              >
                <MaterialIcon color="primary" name="format-list-numbered" size={20} />
              </FormatIcon>
              <FormatIcon
                style={{ marginHorizontal: 10 }}
                onPress={() => dispatchToWebView('BLOCK_DIVIDER')}
              >
                <FeatherIcon size={20} name="minus" color="primary" />
              </FormatIcon>
            </Box>
            <Border marginTop={16} />
            <Box row center marginTop={16}>
              <TouchableBox
                px={10}
                py={5}
                onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'UNDO' })}
              >
                <MaterialIcon name="undo" size={20} color="primary" />
              </TouchableBox>
              <TouchableBox
                px={10}
                py={5}
                onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'REDO' })}
              >
                <MaterialIcon name="redo" size={20} color="primary" />
              </TouchableBox>
            </Box>
          </Box>
        )}
      </Sheet>
    </>
  )
}

const SelectBlock = ({
  navigateBibleView,
  keyboardHeight,
}: {
  navigateBibleView: (type: StudyNavigateBibleType) => void
  keyboardHeight: number
}) => {
  const { t } = useTranslation()
  const { ref, open, close } = useSheet()
  const detachedSheetStyle = useDetachedStudySheetStyle()

  const handleNavigate = (type: StudyNavigateBibleType) => {
    close()
    navigateBibleView(type)
  }

  return (
    <>
      <TouchableBox onPress={open}>
        <MaterialIcon name="add-box" size={22} color="primary" style={{ marginLeft: 'auto' }} />
      </TouchableBox>
      <Sheet
        ref={ref}
        stackBehavior="push"
        detached
        detachedOffset={keyboardHeight}
        {...detachedSheetStyle}
      >
        <ActionSheetItem
          icon="link-2"
          label={t('Insérer un lien de verset')}
          onPress={() => handleNavigate('verse')}
        />
        <ActionSheetItem
          icon="file-text"
          label={t('Insérer un texte de verset')}
          onPress={() => handleNavigate('verse-block')}
        />
        <ActionSheetItem
          icon="link-2"
          label={t('Insérer un lien de strong')}
          onPress={() => handleNavigate('strong')}
        />
        <ActionSheetItem
          icon="file-text"
          label={t('Insérer un texte de strong')}
          onPress={() => handleNavigate('strong-block')}
        />
      </Sheet>
    </>
  )
}

const FormatIcon = styled(TouchableOpacity)<TouchableOpacityProps & { isSelected?: boolean }>(
  ({ theme, isSelected }) => ({
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isSelected ? theme.colors.lightPrimary : 'transparent',
  })
)

type StudyFooterProps = {
  dispatchToWebView: DispatchToWebView
  navigateBibleView: (type: StudyNavigateBibleType) => void
  activeFormats: ActiveFormats
  keyboardHeight: number
}

const StudyFooterComponent = ({
  dispatchToWebView,
  navigateBibleView,
  activeFormats,
  keyboardHeight,
}: StudyFooterProps) => {
  return (
    <Box row height={50} backgroundColor="reverse" alignItems="center">
      <Box row flex center paddingLeft={10}>
        <SelectHeading
          dispatchToWebView={dispatchToWebView}
          activeFormats={activeFormats}
          keyboardHeight={keyboardHeight}
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
        <SelectMore
          dispatchToWebView={dispatchToWebView}
          activeFormats={activeFormats}
          keyboardHeight={keyboardHeight}
        />
        <Box marginLeft="auto" />
        <SelectBlock navigateBibleView={navigateBibleView} keyboardHeight={keyboardHeight} />
      </Box>
      <Link paddingSmall onPress={() => dispatchToWebView('BLUR_EDITOR')}>
        <MaterialIcon name="keyboard-hide" size={20} color="primary" />
      </Link>
    </Box>
  )
}

const StudyFooter = memo(StudyFooterComponent, (prevProps, nextProps) => {
  return JSON.stringify(prevProps.activeFormats) === JSON.stringify(nextProps.activeFormats)
})

export default StudyFooter
