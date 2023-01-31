import React from 'react'
import TouchableSvgIcon from '~features/bible/TouchableSvgIcon'
import { wp } from '~helpers/utils'
import CommentIcon from '~common/CommentIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import RefIcon from '~common/RefIcon'
import Box from '../../../common/ui/Box'
import { HStack } from '../../../common/ui/Stack'
import { useTranslation } from 'react-i18next'
import { BibleResource } from '~common/types'
import { runOnUI, SharedValue } from 'react-native-reanimated'

type Props = {
  resourceType: BibleResource | null
  onChangeResourceType: (resourceType: BibleResource) => void
  direction: SharedValue<'left' | 'right'>
}

const getPosition = (resourceType: BibleResource) => {
  'worklet'
  return ['strong', 'dictionary', 'nave', 'reference', 'commentary'].indexOf(
    resourceType
  )
}

const ResourcesModalFooter = ({
  resourceType,
  onChangeResourceType,
  direction,
}: Props) => {
  const { t } = useTranslation()

  const setDirection = (
    prevResourceType: BibleResource,
    nextResourceType: BibleResource
  ) => {
    'worklet'

    const prevPosition = getPosition(prevResourceType)
    const nextPosition = getPosition(nextResourceType)

    if (prevPosition < nextPosition) {
      direction.value = 'left'
      return
    }
    direction.value = 'right'
  }

  const onPress = (newResourceType: BibleResource) => {
    runOnUI(setDirection)(resourceType!, newResourceType)
    onChangeResourceType(newResourceType)
  }

  return (
    <HStack spacing={0} borderTopWidth={1} borderColor="border" h={54}>
      <Box width={wp(20, 400)} opacity={resourceType === 'strong' ? 1 : 0.3}>
        <TouchableSvgIcon
          icon={LexiqueIcon}
          color={resourceType === 'strong' ? 'primary' : 'grey'}
          onPress={() => onPress('strong')}
          label={t('Lexique')}
        />
      </Box>
      <Box
        width={wp(20, 400)}
        opacity={resourceType === 'dictionary' ? 1 : 0.3}
      >
        <TouchableSvgIcon
          icon={DictionnaireIcon}
          color={resourceType === 'dictionary' ? 'secondary' : 'grey'}
          onPress={() => onPress('dictionary')}
          label={t('Dictionnaire')}
        />
      </Box>
      <Box width={wp(20, 400)} opacity={resourceType === 'nave' ? 1 : 0.3}>
        <TouchableSvgIcon
          icon={NaveIcon}
          color={resourceType === 'nave' ? 'quint' : 'grey'}
          onPress={() => onPress('nave')}
          label={t('Thèmes')}
        />
      </Box>
      <Box width={wp(20, 400)} opacity={resourceType === 'reference' ? 1 : 0.3}>
        <TouchableSvgIcon
          icon={RefIcon}
          color={resourceType === 'reference' ? 'quart' : 'grey'}
          onPress={() => onPress('reference')}
          label={t('Références')}
        />
      </Box>
      <Box
        width={wp(20, 400)}
        opacity={resourceType === 'commentary' ? 1 : 0.3}
      >
        <TouchableSvgIcon
          icon={CommentIcon}
          color={resourceType === 'commentary' ? '#26A69A' : 'grey'}
          onPress={() => onPress('commentary')}
          label={t('Comment.')}
        />
      </Box>
    </HStack>
  )
}

export default ResourcesModalFooter
