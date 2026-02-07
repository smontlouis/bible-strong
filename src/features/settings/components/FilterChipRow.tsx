import React from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import Animated from 'react-native-reanimated'

import Text from '~common/ui/Text'

export type StatusFilter = 'downloaded' | 'notDownloaded'
export type LangFilter = 'fr' | 'en' | 'other'

interface FilterChipRowProps {
  statusFilter: Set<StatusFilter>
  langFilter: Set<LangFilter>
  onStatusToggle: (status: StatusFilter) => void
  onLangToggle: (lang: LangFilter) => void
}

interface ChipConfig {
  key: string
  label: string
  isActive: boolean
  onPress: () => void
}

const FilterChipRow = ({
  statusFilter,
  langFilter,
  onStatusToggle,
  onLangToggle,
}: FilterChipRowProps) => {
  const { t } = useTranslation()
  const theme = useTheme()

  const chips: ChipConfig[] = [
    {
      key: 'downloaded',
      label: t('downloads.filter.downloaded'),
      isActive: statusFilter.has('downloaded'),
      onPress: () => onStatusToggle('downloaded'),
    },
    {
      key: 'notDownloaded',
      label: t('downloads.filter.notDownloaded'),
      isActive: statusFilter.has('notDownloaded'),
      onPress: () => onStatusToggle('notDownloaded'),
    },
    {
      key: 'fr',
      label: 'FR',
      isActive: langFilter.has('fr'),
      onPress: () => onLangToggle('fr'),
    },
    {
      key: 'en',
      label: 'EN',
      isActive: langFilter.has('en'),
      onPress: () => onLangToggle('en'),
    },
    {
      key: 'other',
      label: t('downloads.filter.originalLangs'),
      isActive: langFilter.has('other'),
      onPress: () => onLangToggle('other'),
    },
  ]

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}
    >
      {chips.map(chip => (
        <TouchableOpacity key={chip.key} onPress={chip.onPress} activeOpacity={0.7}>
          <Animated.View
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 16,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: chip.isActive ? theme.colors.primary : theme.colors.border,
              transitionProperty: 'backgroundColor',
              transitionDuration: 200,
            }}
          >
            <Text
              fontSize={13}
              bold
              style={{
                color: chip.isActive ? '#fff' : theme.colors.default,
              }}
            >
              {chip.label}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

export default FilterChipRow
