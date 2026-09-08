import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ContextualPanel from './ContextualPanel'
import PanelSearch from './ContextualPanel/PanelSearch'
import Box, { TouchableBox } from './ui/Box'
import Text from './ui/Text'
import { FeatherIcon } from './ui/Icon'
import type { DropdownMenuProps } from './DropdownMenu'

export default function DropdownMenu<T extends string | number = string>({
  currentValue,
  setValue,
  choices,
  title,
  customRender,
  searchable = choices.length > 10,
}: DropdownMenuProps<T>) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const selected = choices.find(choice => choice.value === currentValue)
  const visible = choices.filter(choice =>
    `${choice.label} ${choice.subLabel ?? ''}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase())
  )
  return (
    <ContextualPanel
      width={320}
      initialScreen="choices"
      accessibilityLabel={selected ? `${title}: ${selected.label}` : title}
      onClose={() => setQuery('')}
      trigger={
        customRender || (
          <Box className="p-[10px]">
            <Text className="text-grey text-[12px]">{title}</Text>
            <Box className="flex-row items-center gap-1">
              <Text className="font-bold text-[12px]">{selected?.label}</Text>
              <FeatherIcon name="chevron-down" size={15} />
            </Box>
          </Box>
        )
      }
      screens={{
        choices: {
          title,
          headerContent: searchable ? <PanelSearch value={query} onChange={setQuery} /> : undefined,
          content: nav => (
            <>
              {visible.map(choice => (
                <TouchableBox
                  key={String(choice.value)}
                  className="w-full flex-row items-center gap-3 p-3 rounded-lg"
                  accessibilityRole="radio"
                  accessibilityState={{ checked: choice.value === currentValue }}
                  onPress={() => {
                    setValue(choice.value)
                    nav.close()
                  }}
                >
                  <Box className="flex-1 min-w-0">
                    <Text className="text-[14px]">{choice.label}</Text>
                    {!!choice.subLabel && (
                      <Text className="text-[12px] text-tertiary mt-1">{choice.subLabel}</Text>
                    )}
                  </Box>
                  {choice.value === currentValue && (
                    <FeatherIcon name="check" size={17} color="primary" />
                  )}
                </TouchableBox>
              ))}
              {!visible.length && <Text className="p-3 text-grey">{t('Aucun résultat')}</Text>}
            </>
          ),
        },
      }}
    />
  )
}
