import { useTranslation } from 'react-i18next'
import type { ComponentProps } from 'react'
import { useTheme } from '~themes/ThemeProvider'
import { resolveThemeColor } from '~themes/colorValues'
import { FeatherIcon } from '~common/ui/Icon'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import PageContent from '~common/ui/PageContent'
import Back from './Back'
import ContextualPanel from './ContextualPanel'
import type { PanelScreen } from './ContextualPanel/types'
export type FiltersHeaderItem = {
  key: string
  icon: ComponentProps<typeof FeatherIcon>['name']
  label: string
  value?: string
  color?: string
  active?: boolean
  onPress: () => void
  options?: {
    key: string
    label: string
    selected: boolean
    color?: string
    onSelect: () => void
  }[]
}
export default function FiltersHeader({
  title,
  hasBackButton,
  filters,
  onReset,
}: {
  title: string
  hasBackButton?: boolean
  filters: FiltersHeaderItem[]
  onReset?: () => void
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const activeCount = filters.filter(filter => filter.active).length
  const reset =
    activeCount > 0 && onReset ? (
      <TouchableBox onPress={onReset} accessibilityRole="button" className="p-2">
        <Text className="text-primary text-[12px]">{t('Réinitialiser')}</Text>
      </TouchableBox>
    ) : undefined
  const screens: Record<string, PanelScreen> = {
    filters: {
      title: t('Filtres'),
      headerRight: reset,
      content: navigation => (
        <>
          {filters.map(filter => (
            <TouchableBox
              key={filter.key}
              accessibilityRole="button"
              className="w-full flex-row items-center gap-3 p-3 rounded-lg"
              onPress={() => {
                if (filter.options) navigation.open(filter.key)
                else {
                  navigation.close()
                  filter.onPress()
                }
              }}
            >
              <FeatherIcon
                name={filter.icon}
                size={17}
                color={filter.active ? 'primary' : 'tertiary'}
              />
              <Text className="flex-1 text-[14px]">{filter.label}</Text>
              {!!filter.color && (
                <Box
                  className="w-5 h-5 rounded-md"
                  style={{ backgroundColor: resolveThemeColor(theme, filter.color) }}
                />
              )}
              <Text className="text-[12px] text-tertiary max-w-[130px]" numberOfLines={1}>
                {filter.value}
              </Text>
              <FeatherIcon name="chevron-right" size={15} />
            </TouchableBox>
          ))}
        </>
      ),
    },
  }
  for (const filter of filters) {
    if (!filter.options) continue
    screens[filter.key] = {
      title: filter.label,
      headerRight: reset,
      content: () => (
        <>
          {filter.options!.map(option => (
            <TouchableBox
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: option.selected }}
              className="w-full flex-row items-center gap-3 p-3 rounded-lg"
              onPress={option.onSelect}
            >
              {!!option.color && (
                <Box className="w-5 h-5 rounded-md" style={{ backgroundColor: option.color }} />
              )}
              <Text className="flex-1 text-[14px]">{option.label}</Text>
              {option.selected && <FeatherIcon name="check" size={17} color="primary" />}
            </TouchableBox>
          ))}
        </>
      ),
    }
  }
  return (
    <Box className="bg-reverse border-b border-border" testID="workspace-page-header">
      <PageContent className="min-h-[54px] items-center flex-row">
        {hasBackButton ? (
          <Back padding>
            <FeatherIcon name="arrow-left" size={20} />
          </Back>
        ) : (
          <Box className="w-[15px]" />
        )}
        <Text className="flex-1 text-[14px] font-bold">{title}</Text>
        <ContextualPanel
          accessibilityLabel={t('Filtrer')}
          initialScreen="filters"
          screens={screens}
          trigger={
            <HStack className="items-center gap-1 p-2">
              <Text className="text-[14px]">
                {t('Filtrer')}
                {activeCount ? ` · ${activeCount}` : ''}
              </Text>
              <FeatherIcon name="chevron-down" size={14} />
            </HStack>
          }
        />
      </PageContent>
    </Box>
  )
}
