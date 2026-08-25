import React from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '../../utils/constants'
import useSearchButtonPress from './useSearchButton'

export type SearchButtonProps = Record<string, never>

const SearchButton = (_props: SearchButtonProps) => {
  const { t } = useTranslation()
  const { onPress } = useSearchButtonPress()

  return (
    <TouchableBox
      center
      size={TAB_ICON_SIZE}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('tabs.search')}
    >
      <FeatherIcon name="search" size={23} color="tertiary" />
    </TouchableBox>
  )
}

export default SearchButton
