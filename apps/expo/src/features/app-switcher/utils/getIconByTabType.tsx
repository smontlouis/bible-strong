import { getUniverseColor } from '~themes/universeColors'
import { useTheme } from '~themes/ThemeProvider'
import { Image } from 'expo-image'
import React from 'react'
import { TabItem } from '../../../state/tabs'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
const icons = {
  bible: require('~assets/images/tab-icons/book-open.svg'),
  strong: require('~assets/images/tab-icons/lexique.svg'),
  commentary: require('~assets/images/tab-icons/comment.svg'),
  'commentary-resource': require('~assets/images/tab-icons/comment.svg'),
  dictionary: require('~assets/images/tab-icons/dictionary.svg'),
  search: require('~assets/images/tab-icons/search.svg'),
  nave: require('~assets/images/tab-icons/nave.svg'),
  study: require('~assets/images/tab-icons/feather.svg'),
  notes: require('~assets/images/tab-icons/file-text.svg'),
  new: require('~assets/images/tab-icons/plus.svg'),
  default: require('~assets/images/tab-icons/x.svg'),
}

export const tabIconColorConfig: Partial<Record<TabItem['type'], string>> = {
  bible: getUniverseColor('bible'),
  search: getUniverseColor('search'),
  compare: getUniverseColor('compare'),
  plan: getUniverseColor('plan'),
  timeline: getUniverseColor('timeline'),
  study: getUniverseColor('study'),
  notes: getUniverseColor('notes'),
  strong: getUniverseColor('strong'),
  nave: getUniverseColor('nave'),
  dictionary: getUniverseColor('dictionary'),
  commentary: getUniverseColor('commentary'),
  'commentary-resource': getUniverseColor('commentary-resource'),
}

interface TabIconProps {
  type: TabItem['type']
  size?: number
  color?: string
}

const TabIcon = ({ type, size = 14, color }: TabIconProps) => {
  const theme = useTheme()
  const source = icons[type as keyof typeof icons] || icons.default
  const configuredColor = color || tabIconColorConfig[type]
  const tintColor =
    theme.colors[configuredColor as keyof typeof theme.colors] ||
    configuredColor ||
    theme.colors.default

  if (type === 'compare') {
    return <FeatherIcon name="layers" size={size} color={tintColor} />
  }

  if (type === 'plan') {
    return <MaterialIcon name="playlist-add-check" size={size} color={tintColor} />
  }

  if (type === 'timeline') {
    return <MaterialIcon name="timeline" size={size} color={tintColor} />
  }

  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      tintColor={tintColor}
      contentFit="contain"
    />
  )
}

export default TabIcon
