import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'

import Header from '~common/Header'
import SearchInput from '~common/SearchInput'
import Box, { HStack, SafeAreaBox, usePageBottomInset } from '~common/ui/Box'
import ListSection from '~common/ui/ListSection'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import {
  SHORTCUT_SECTIONS,
  isMacPlatform,
  shortcutKeys,
  type ShortcutRow,
} from '~features/keyboard-shortcuts/keymap'
import { normalizeSearchText } from '~features/search/shared/searchFuzzy'

/** One key as printed on the keyboard: a mark set in the card, so radius 4 on the page's ground. */
const Keycap = ({ label }: { label: string }) => (
  <Box className="min-w-[24px] h-[24px] px-[6px] rounded-[4px] bg-canvas items-center justify-center">
    <Text className="text-[12px]" style={{ fontVariant: ['tabular-nums'] }}>
      {label}
    </Text>
  </Box>
)

const ShortcutKeys = ({ row, mac }: { row: ShortcutRow; mac: boolean }) => (
  <HStack className="items-center gap-[4px] shrink-0">
    {row.shortcuts.map((id, index) => (
      <Fragment key={id}>
        {index > 0 && <Text className="text-[12px] text-tertiary mx-[2px]">/</Text>}
        {shortcutKeys(id, mac).map(key => (
          <Keycap key={key} label={key} />
        ))}
      </Fragment>
    ))}
  </HStack>
)

/** Every keyboard shortcut of the web app, from the keymap the listeners use. */
const KeyboardShortcutsScreen = () => {
  const { t } = useTranslation()
  const bottomInset = usePageBottomInset()
  const [query, setQuery] = useState('')
  const mac = isMacPlatform()
  const modifier = mac ? 'Ctrl' : 'Alt'
  const search = normalizeSearchText(query.trim())
  const sections = SHORTCUT_SECTIONS.map(section => ({
    ...section,
    rows: search
      ? section.rows.filter(row => normalizeSearchText(t(row.label)).includes(search))
      : section.rows,
  })).filter(section => section.rows.length)

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-canvas">
      <Header hasBackButton title={t('settings.keyboardShortcuts')} />
      <ScrollView
        backgroundColor="canvas"
        contentContainerStyle={{ paddingBottom: 20 + bottomInset }}
      >
        <Box className="mx-[20px] mt-[8px] mb-[22px]">
          <SearchInput
            value={query}
            onChangeText={setQuery}
            onDelete={() => setQuery('')}
            placeholder={t('shortcutGuide.filter')}
          />
          <Text className="text-[13px] text-grey mt-[4px] mx-[4px]">
            {t('shortcutGuide.fieldsHint')}
          </Text>
        </Box>
        {sections.map(section => (
          <ListSection
            key={section.title}
            title={t(section.title)}
            footer={section.hint && !search ? t(section.hint, { modifier }) : undefined}
          >
            {section.rows.map(row => (
              <HStack
                key={row.label}
                className="min-h-[44px] px-[14px] py-[8px] items-center gap-[12px]"
              >
                <Text className="flex-1 text-[15px]">{t(row.label)}</Text>
                <ShortcutKeys row={row} mac={mac} />
              </HStack>
            ))}
          </ListSection>
        ))}
        {!sections.length && (
          <Text className="text-[15px] text-grey text-center mt-[32px]">
            {t('shortcutGuide.noMatch')}
          </Text>
        )}
      </ScrollView>
    </SafeAreaBox>
  )
}

export default KeyboardShortcutsScreen
