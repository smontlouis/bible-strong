import React, { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, TouchableOpacity } from 'react-native'
import CommentIcon from '~common/CommentIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import RefIcon from '~common/RefIcon'
import { BibleResource } from '~common/types'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import TouchableSvgIcon from '~features/bible/TouchableSvgIcon'
import { wp } from '~helpers/utils'

type Props = {
  resourceType: BibleResource | null
  onChangeResourceType: (resourceType: BibleResource) => void
}

const ResourcesModalFooter = memo(({ resourceType, onChangeResourceType }: Props) => {
  const { t } = useTranslation()
  const { bottomBarHeight } = useBottomBarHeightInTab()

  const onPress = (newResourceType: BibleResource) => {
    onChangeResourceType(newResourceType)
  }

  const iconWidth = wp(18)

  return (
    <Box
      borderTopWidth={1}
      borderColor="border"
      bg="reverse"
      h={54 + bottomBarHeight}
      paddingBottom={bottomBarHeight}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <HStack spacing={0} flex={1}>
          <Box w={iconWidth} opacity={resourceType === 'strong' ? 1 : 0.3}>
            <TouchableSvgIcon
              icon={LexiqueIcon}
              color={resourceType === 'strong' ? 'primary' : 'grey'}
              onPress={() => onPress('strong')}
              label={t('Lexique')}
            />
          </Box>
          <Box w={iconWidth} opacity={resourceType === 'dictionary' ? 1 : 0.3}>
            <TouchableSvgIcon
              icon={DictionnaireIcon}
              color={resourceType === 'dictionary' ? 'secondary' : 'grey'}
              onPress={() => onPress('dictionary')}
              label={t('Dictionnaire')}
            />
          </Box>
          <Box w={iconWidth} opacity={resourceType === 'nave' ? 1 : 0.3}>
            <TouchableSvgIcon
              icon={NaveIcon}
              color={resourceType === 'nave' ? 'quint' : 'grey'}
              onPress={() => onPress('nave')}
              label={t('Thèmes')}
            />
          </Box>
          <Box w={iconWidth} opacity={resourceType === 'reference' ? 1 : 0.3}>
            <TouchableSvgIcon
              icon={RefIcon}
              color={resourceType === 'reference' ? 'quart' : 'grey'}
              onPress={() => onPress('reference')}
              label={t('Références')}
            />
          </Box>
          <Box w={iconWidth} opacity={resourceType === 'commentary' ? 1 : 0.3}>
            <TouchableSvgIcon
              icon={CommentIcon}
              color={resourceType === 'commentary' ? '#26A69A' : 'grey'}
              onPress={() => onPress('commentary')}
              label={t('Comment.')}
            />
          </Box>
          <Box w={iconWidth} opacity={resourceType === 'compare' ? 1 : 0.3}>
            <TouchableOpacity
              onPress={() => onPress('compare')}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <FeatherIcon
                name="layers"
                size={20}
                color={resourceType === 'compare' ? '#00897B' : 'grey'}
              />
              <Text marginTop={5} fontSize={9} color="grey">
                {t('Comparer')}
              </Text>
            </TouchableOpacity>
          </Box>
        </HStack>
      </ScrollView>
    </Box>
  )
})

export default ResourcesModalFooter
