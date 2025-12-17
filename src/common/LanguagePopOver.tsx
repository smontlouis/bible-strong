import React, { useState } from 'react'
import { useTheme } from '@emotion/react'
import { TouchableOpacity } from 'react-native'
import Popover from 'react-native-popover-view'

import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { Theme } from '~themes'
import { ResourcesLanguageState, useResourceLanguage } from 'src/state/resourcesLanguage'
import type { ResourceLanguage } from '~helpers/databaseTypes'

interface Props {
  resourceId: keyof ResourcesLanguageState
}

const LanguagePopOver = ({ resourceId }: Props) => {
  const theme: Theme = useTheme()
  const [showPopover, setShowPopover] = useState(false)
  const [currentLang, setLang] = useResourceLanguage(resourceId)

  const handleSelect = (lang: ResourceLanguage) => {
    setLang(lang)
    setShowPopover(false)
  }

  return (
    <Popover
      isVisible={showPopover}
      onRequestClose={() => setShowPopover(false)}
      popoverStyle={{
        backgroundColor: theme.colors.reverse,
        borderRadius: 10,
      }}
      from={
        <TouchableOpacity onPress={() => setShowPopover(true)}>
          <Box row center height={54} width={40}>
            <FeatherIcon name="globe" size={20} />
          </Box>
        </TouchableOpacity>
      }
    >
      <Box paddingVertical={5}>
        <TouchableOpacity onPress={() => handleSelect('fr')}>
          <HStack alignItems="center" paddingVertical={10} paddingHorizontal={15} gap={10}>
            <Text flex>Français</Text>
            {currentLang === 'fr' && <FeatherIcon name="check" size={16} />}
          </HStack>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleSelect('en')}>
          <HStack alignItems="center" paddingVertical={10} paddingHorizontal={15} gap={10}>
            <Text flex>English</Text>
            {currentLang === 'en' && <FeatherIcon name="check" size={16} />}
          </HStack>
        </TouchableOpacity>
      </Box>
    </Popover>
  )
}

export default LanguagePopOver
