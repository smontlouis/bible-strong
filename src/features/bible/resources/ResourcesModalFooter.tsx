import React, { memo } from 'react'
import { useTranslation } from 'react-i18next'
import CommentIcon from '~common/CommentIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import RefIcon from '~common/RefIcon'
import { BibleResource } from '~common/types'
import TouchableSvgIcon from '~features/bible/TouchableSvgIcon'
import { wp } from '~helpers/utils'
import Box from '../../../common/ui/Box'
import { HStack } from '../../../common/ui/Stack'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'

type Props = {
  resourceType: BibleResource | null
  onChangeResourceType: (resourceType: BibleResource) => void
}

const getPosition = (resourceType: BibleResource) => {
  'worklet'
  return ['strong', 'dictionary', 'nave', 'reference', 'commentary'].indexOf(resourceType)
}

const ResourcesModalFooter = memo(({ resourceType, onChangeResourceType }: Props) => {
  const { t } = useTranslation()
  const { bottomBarHeight } = useBottomBarHeightInTab()

  const onPress = (newResourceType: BibleResource) => {
    onChangeResourceType(newResourceType)
  }

  return (
    <HStack
      spacing={0}
      borderTopWidth={1}
      borderColor="border"
      bg="reverse"
      h={54 + bottomBarHeight}
      paddingBottom={bottomBarHeight}
    >
      <Box flex={1} opacity={resourceType === 'strong' ? 1 : 0.3}>
        <TouchableSvgIcon
          icon={LexiqueIcon}
          color={resourceType === 'strong' ? 'primary' : 'grey'}
          onPress={() => onPress('strong')}
          label={t('Lexique')}
        />
      </Box>
      <Box flex={1} opacity={resourceType === 'dictionary' ? 1 : 0.3}>
        <TouchableSvgIcon
          icon={DictionnaireIcon}
          color={resourceType === 'dictionary' ? 'secondary' : 'grey'}
          onPress={() => onPress('dictionary')}
          label={t('Dictionnaire')}
        />
      </Box>
      <Box flex={1} opacity={resourceType === 'nave' ? 1 : 0.3}>
        <TouchableSvgIcon
          icon={NaveIcon}
          color={resourceType === 'nave' ? 'quint' : 'grey'}
          onPress={() => onPress('nave')}
          label={t('Thèmes')}
        />
      </Box>
      <Box flex={1} opacity={resourceType === 'reference' ? 1 : 0.3}>
        <TouchableSvgIcon
          icon={RefIcon}
          color={resourceType === 'reference' ? 'quart' : 'grey'}
          onPress={() => onPress('reference')}
          label={t('Références')}
        />
      </Box>
      <Box flex={1} opacity={resourceType === 'commentary' ? 1 : 0.3}>
        <TouchableSvgIcon
          icon={CommentIcon}
          color={resourceType === 'commentary' ? '#26A69A' : 'grey'}
          onPress={() => onPress('commentary')}
          label={t('Comment.')}
        />
      </Box>
    </HStack>
  )
})

export default ResourcesModalFooter
