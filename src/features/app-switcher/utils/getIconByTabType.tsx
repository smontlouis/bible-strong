import { useTheme } from '@emotion/react'
import { Image } from 'expo-image'
import React from 'react'
import { TabItem } from '../../../state/tabs'

const icons = {
  bible: require('~assets/images/tab-icons/book-open.svg'),
  compare: require('~assets/images/tab-icons/repeat.svg'),
  strong: require('~assets/images/tab-icons/lexique.svg'),
  commentary: require('~assets/images/tab-icons/comment.svg'),
  dictionary: require('~assets/images/tab-icons/dictionary.svg'),
  search: require('~assets/images/tab-icons/search.svg'),
  nave: require('~assets/images/tab-icons/nave.svg'),
  study: require('~assets/images/tab-icons/feather.svg'),
  notes: require('~assets/images/tab-icons/file-text.svg'),
  new: require('~assets/images/tab-icons/plus.svg'),
  default: require('~assets/images/tab-icons/x.svg'),
}

interface TabIconProps {
  type: TabItem['type']
  size?: number
  color?: string
}

const TabIcon = ({ type, size = 14, color }: TabIconProps) => {
  const theme = useTheme()
  const source = icons[type as keyof typeof icons] || icons.default
  const tintColor = color || theme.colors.default

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
