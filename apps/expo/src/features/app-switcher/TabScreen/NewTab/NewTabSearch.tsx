import { usePathname } from 'expo-router'
import { useAtom, useAtomValue } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, Platform, TextInput } from 'react-native'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { activeTabIdAtom, appSwitcherModeAtom, type TabItem } from '~state/tabs'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'

export default function NewTabSearch({
  tabAtom,
}: {
  tabAtom: PrimitiveAtom<TabItem>
  onPlanPress?: () => void
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [tab, setTab] = useAtom(tabAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const mode = useAtomValue(appSwitcherModeAtom)
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const input = useRef<TextInput>(null)
  const isActive = activeTabId === tab.id && mode === 'view' && pathname === '/'
  const [shortcut, setShortcut] = useState('Ctrl K')

  useEffect(() => {
    if (Platform.OS !== 'web') return
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K')
    if (!isActive) return
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        input.current?.focus()
      }
    }
    document.addEventListener('keydown', focusSearch)
    return () => document.removeEventListener('keydown', focusSearch)
  }, [isActive])

  const search = () => {
    const value = query.trim()
    if (!value) return
    Keyboard.dismiss()
    setTab(previous => ({
      ...previous,
      type: 'search',
      title: value,
      base64Preview: '',
      data: { searchValue: value },
    }))
  }

  return (
    <Box
      dataSet={{ focusGroup: 'true' }}
      className="flex-row items-center bg-reverse rounded-[16px] border px-[12px] min-h-[58px] gap-[10px]"
      style={{
        borderColor:
          Platform.OS !== 'web' && focused ? theme.colors.primary : theme.colors.lightPrimary,
      }}
    >
      <TouchableBox
        accessibilityLabel={t('Rechercher')}
        onPress={search}
        disabled={!query.trim()}
        className="w-[32px] min-h-[44px] items-center justify-center"
      >
        <FeatherIcon name="search" size={21} color="tertiary" />
      </TouchableBox>
      <TextInput
        ref={input}
        testID="new-tab-search"
        accessibilityLabel={t('newTab.searchPlaceholder')}
        placeholder={t('newTab.searchPlaceholder')}
        placeholderTextColor={theme.colors.tertiary}
        value={query}
        onChangeText={setQuery}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={search}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          flex: 1,
          minWidth: 0,
          height: 54,
          padding: 0,
          fontSize: 14,
          color: theme.colors.default,
          fontFamily: resolveFontFamily(theme.fontFamily.text),
          ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
        }}
      />
      {query.trim() ? (
        <TouchableBox
          onPress={search}
          accessibilityLabel={t('Rechercher')}
          className="min-w-[44px] min-h-[44px] items-center justify-center rounded-[10px] bg-light-grey"
        >
          <FeatherIcon name="arrow-right" size={19} color="primary" />
        </TouchableBox>
      ) : Platform.OS === 'web' ? (
        <TouchableBox
          onPress={() => input.current?.focus()}
          accessibilityLabel={t('newTab.focusSearch')}
          className="min-w-[44px] min-h-[44px] items-center justify-center"
        >
          <Box className="rounded-[6px] bg-light-grey px-[7px] py-[5px]">
            <Text className="text-[11px] text-tertiary">{shortcut}</Text>
          </Box>
        </TouchableBox>
      ) : null}
    </Box>
  )
}
