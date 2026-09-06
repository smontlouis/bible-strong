import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme, useTheme as useAppTheme } from '~themes/ThemeProvider'
import type { JSONValue } from 'expo/build/dom/dom.types'
import { useAtom } from 'jotai/react'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { useState } from 'react'
import { TouchableOpacity, type TouchableOpacityProps } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import PageContent from '~common/ui/PageContent'
import type { Theme as AppTheme } from '~themes'

import { useTranslation } from 'react-i18next'
import { FadeInDown, FadeOutDown } from 'react-native-reanimated'
import type { ColorFormatsObject } from 'reanimated-color-picker'
import BackgroundIcon from '~assets/images/BackgroundIcon'
import ColorIcon from '~assets/images/ColorIcon'
import QuoteIcon from '~assets/images/QuoteIcon'
import ColorPicker from '~common/ColorPicker'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
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

type StudyFooterMenu = 'heading' | 'more' | 'block' | null
type FeatherIconName = React.ComponentProps<typeof FeatherIcon>['name']

const StudyFooterPopover = ({
  children,
  bottom,
  left,
  right,
  width,
}: {
  children: React.ReactNode
  bottom: number
  left?: number
  right?: number
  width: number
}) => (
  <AnimatedBox
    className="border-continuous overflow-visible absolute bg-reverse rounded-[12px] border-[1px] border-border"
    entering={FadeInDown}
    exiting={FadeOutDown}
    style={{
      width: width,
      bottom: bottom,
      left: left,
      right: right,
      shadowColor: 'rgb(89,131,240)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 7,
      elevation: 1,
      overflow: 'visible',
    }}
  >
    {children}
  </AnimatedBox>
)

const PopoverItem = ({
  icon,
  label,
  color = 'default',
  onPress,
}: {
  icon: FeatherIconName
  label: string
  color?: string
  onPress: () => void
}) => {
  const stylingTheme = useStylingTheme()
  return (
    <TouchableBox
      className="overflow-hidden border-continuous flex-row items-center px-[14px] py-[10px]"
      onPress={onPress}
    >
      <Box className="overflow-hidden border-continuous w-[20px] items-center justify-center">
        <FeatherIcon name={icon} size={16} color={color} />
      </Box>
      <Text
        className="ml-[10px] text-[14px]"
        style={{ color: resolveThemeColor(stylingTheme, color) || stylingTheme.colors.default }}
      >
        {label}
      </Text>
    </TouchableBox>
  )
}

const SelectHeading = ({
  dispatchToWebView,
  activeFormats,
  isOpen,
  onToggle,
  onClose,
}: {
  dispatchToWebView: DispatchToWebView
  activeFormats: ActiveFormats
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}) => {
  const { t } = useTranslation()
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
    <Box
      className="border-continuous overflow-visible relative"
      style={{ zIndex: isOpen ? 20 : 0 }}
    >
      <TouchableBox className="overflow-hidden border-continuous" onPress={onToggle}>
        <Box className="overflow-hidden border-continuous flex-row items-center justify-center rounded-[20px] bg-light-primary py-[4px] px-[7px]">
          <Text className="text-[15px] font-bold text-primary">{t(getHeaderTitle())}</Text>
          <Box className="overflow-hidden border-continuous ml-[5px] rounded-[20px] bg-primary w-[18px] h-[18px] items-center justify-center">
            <FeatherIcon name="chevron-up" color="reverse" size={18} />
          </Box>
        </Box>
      </TouchableBox>
      {isOpen && (
        <StudyFooterPopover bottom={40} left={0} width={220}>
          {headings.map(h => (
            <PopoverItem
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
                onClose()
              }}
            />
          ))}
        </StudyFooterPopover>
      )}
    </Box>
  )
}

const SelectMore = ({
  dispatchToWebView,
  activeFormats,
  isOpen,
  onToggle,
  onClose,
}: {
  dispatchToWebView: DispatchToWebView
  activeFormats: ActiveFormats
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}) => {
  const [colorModal, setOpenColorModal] = useState<'background' | 'color' | undefined>()
  const { t } = useTranslation()
  const [recentColors, setRecentColors] = useAtom(recentColorsAtom)
  const defaultColor = colorModal === 'background' ? '#ffffff' : '#000000'
  const currentColor = colorModal === 'background' ? activeFormats.background : activeFormats.color
  const [selectedColor, setSelectedColor] = useState(currentColor || defaultColor)

  const openColorModal = (mode: 'background' | 'color') => {
    const nextDefault = mode === 'background' ? '#ffffff' : '#000000'
    const nextCurrent = mode === 'background' ? activeFormats.background : activeFormats.color
    setSelectedColor(nextCurrent || nextDefault)
    setOpenColorModal(mode)
  }

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
    onClose()
    setOpenColorModal(undefined)
  }

  const handleResetColor = () => {
    dispatchToWebView('TOGGLE_FORMAT', {
      type: colorModal === 'background' ? 'BACKGROUND' : 'COLOR',
      value: null,
    })
    onClose()
    setOpenColorModal(undefined)
  }

  const toggleFormat = (type: string, value?: JSONValue) => {
    dispatchToWebView('TOGGLE_FORMAT', { type, value })
  }

  return (
    <Box
      className="border-continuous overflow-visible relative"
      style={{ zIndex: isOpen ? 20 : 0 }}
    >
      <TouchableBox
        className="overflow-hidden border-continuous"
        onPress={() => {
          onToggle()
          setOpenColorModal(undefined)
        }}
      >
        <Box className="overflow-hidden border-continuous items-center justify-center w-[44px] h-[50px]">
          <FeatherIcon name="more-horizontal" size={18} color="primary" />
        </Box>
      </TouchableBox>
      {isOpen && (
        <StudyFooterPopover bottom={40} left={-112} width={250}>
          {colorModal ? (
            <Box className="overflow-hidden border-continuous p-[20px]">
              <TouchableBox
                className="overflow-hidden border-continuous bg-light-grey px-[10px] py-[5px] rounded-[20px]"
                onPress={handleResetColor}
              >
                <Text className="text-center text-[12px]">{t('reset')}</Text>
              </TouchableBox>
              <Box className="overflow-hidden border-continuous h-[180px]">
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
            <Box className="overflow-hidden border-continuous p-[10px]">
              <Box className="overflow-hidden border-continuous flex-row items-center justify-center">
                <FormatIcon
                  isSelected={Boolean(activeFormats.background)}
                  style={{ marginHorizontal: 10 }}
                  onPress={() => openColorModal('background')}
                >
                  <BackgroundIcon color={activeFormats.background} />
                </FormatIcon>
                <FormatIcon
                  isSelected={Boolean(activeFormats.color)}
                  style={{ marginHorizontal: 10 }}
                  onPress={() => openColorModal('color')}
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
              <Border className="mt-[16px]" />
              <Box className="overflow-hidden border-continuous flex-row items-center justify-center mt-[16px]">
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
              <Border className="mt-[16px]" />
              <Box className="overflow-hidden border-continuous flex-row items-center justify-center mt-[16px]">
                <TouchableBox
                  className="overflow-hidden border-continuous px-[10px] py-[5px]"
                  onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'UNDO' })}
                >
                  <MaterialIcon name="undo" size={20} color="primary" />
                </TouchableBox>
                <TouchableBox
                  className="overflow-hidden border-continuous px-[10px] py-[5px]"
                  onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'REDO' })}
                >
                  <MaterialIcon name="redo" size={20} color="primary" />
                </TouchableBox>
              </Box>
            </Box>
          )}
        </StudyFooterPopover>
      )}
    </Box>
  )
}

const SelectBlock = ({
  onInsertEntity,
  isOpen,
  onToggle,
  onClose,
}: {
  onInsertEntity: (mode: 'link' | 'block') => void
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}) => {
  const { t } = useTranslation()

  const handleInsert = (mode: 'link' | 'block') => {
    onClose()
    onInsertEntity(mode)
  }

  return (
    <Box
      className="border-continuous overflow-visible relative"
      style={{ zIndex: isOpen ? 20 : 0 }}
    >
      <TouchableBox className="overflow-hidden border-continuous" onPress={onToggle}>
        <MaterialIcon name="add-box" size={22} color="primary" style={{ marginLeft: 'auto' }} />
      </TouchableBox>
      {isOpen && (
        <StudyFooterPopover bottom={30} right={0} width={250}>
          <PopoverItem
            icon="link-2"
            label={t('Ajouter un lien')}
            onPress={() => handleInsert('link')}
          />
          <PopoverItem
            icon="file-text"
            label={t('Ajouter un bloc')}
            onPress={() => handleInsert('block')}
          />
        </StudyFooterPopover>
      )}
    </Box>
  )
}

const FormatIcon = (
  componentProps: Omit<
    UIComponentProps<typeof TouchableOpacity>,
    keyof (TouchableOpacityProps & { isSelected?: boolean }) | 'theme'
  > &
    Omit<TouchableOpacityProps & { isSelected?: boolean }, 'theme'> & {
      theme?: AppTheme
      className?: string
    }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isSelected } = props
  const classStyles = useResolveClassNames(
    twMerge('w-[25px] h-[25px] items-center justify-center', className)
  )
  return (
    <TouchableOpacity
      {...props}
      style={
        [
          classStyles,
          { backgroundColor: isSelected ? theme.colors.lightPrimary : 'transparent' },
          props.style,
        ] as UIComponentProps<typeof TouchableOpacity>['style']
      }
    />
  )
}

type StudyFooterProps = {
  dispatchToWebView: DispatchToWebView
  onInsertEntity: (mode: 'link' | 'block') => void
  activeFormats: ActiveFormats
}

const StudyFooter = ({ dispatchToWebView, onInsertEntity, activeFormats }: StudyFooterProps) => {
  const [openMenu, setOpenMenu] = useState<StudyFooterMenu>(null)
  const toggleMenu = (menu: Exclude<StudyFooterMenu, null>) => {
    setOpenMenu(currentMenu => (currentMenu === menu ? null : menu))
  }
  const closeMenu = () => setOpenMenu(null)

  return (
    <Box className="border-continuous overflow-visible h-[50px] bg-reverse">
      <PageContent className="flex-[1] items-center flex-row overflow-visible">
        {openMenu && (
          <TouchableBox
            className="overflow-hidden border-continuous absolute left-[-1000px] right-[-1000px] bottom-[0px] top-[-1000px] z-[1]"
            onPress={closeMenu}
          />
        )}
        <Box className="border-continuous overflow-visible flex-row flex-[1] items-center justify-center pl-[10px]">
          <SelectHeading
            dispatchToWebView={dispatchToWebView}
            activeFormats={activeFormats}
            isOpen={openMenu === 'heading'}
            onToggle={() => toggleMenu('heading')}
            onClose={closeMenu}
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
            isOpen={openMenu === 'more'}
            onToggle={() => toggleMenu('more')}
            onClose={closeMenu}
          />
          <Box className="overflow-hidden border-continuous ml-auto" />
          <SelectBlock
            onInsertEntity={onInsertEntity}
            isOpen={openMenu === 'block'}
            onToggle={() => toggleMenu('block')}
            onClose={closeMenu}
          />
        </Box>
        <Link paddingSmall onPress={() => dispatchToWebView('BLUR_EDITOR')}>
          <MaterialIcon name="keyboard-hide" size={20} color="primary" />
        </Link>
      </PageContent>
    </Box>
  )
}

export default StudyFooter
