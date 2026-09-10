import { getUniverseColor } from '~themes/universeColors'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, ScrollView, TouchableOpacity } from 'react-native'
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
import TouchableSvgIcon from '~features/bible/TouchableSvgIcon'
import { wp } from '~helpers/utils'
type Props = {
  resourceType: BibleResource | null
  onChangeResourceType: (resourceType: BibleResource) => void
}

const ResourcesModalFooter = memo(({ resourceType, onChangeResourceType }: Props) => {
  const { t } = useTranslation()

  const onPress = (newResourceType: BibleResource) => {
    onChangeResourceType(newResourceType)
  }

  const iconWidth = Platform.OS === 'web' ? 74 : wp(18)

  return (
    <Box className="border-continuous overflow-hidden mx-[20px] bg-reverse py-[10px] rounded-[20px] border-[1px] border-border">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <HStack className="flex-[1]" spacing={0}>
          <Box
            className="overflow-hidden border-continuous"
            style={{ width: iconWidth, opacity: resourceType === 'strong' ? 1 : 0.3 }}
          >
            <TouchableSvgIcon
              icon={LexiqueIcon}
              color={resourceType === 'strong' ? getUniverseColor('strong') : 'grey'}
              onPress={() => onPress('strong')}
              label={t('Lexique')}
            />
          </Box>
          <Box
            className="overflow-hidden border-continuous"
            style={{ width: iconWidth, opacity: resourceType === 'dictionary' ? 1 : 0.3 }}
          >
            <TouchableSvgIcon
              icon={DictionnaireIcon}
              color={resourceType === 'dictionary' ? getUniverseColor('dictionary') : 'grey'}
              onPress={() => onPress('dictionary')}
              label={t('Dictionnaire')}
            />
          </Box>
          <Box
            className="overflow-hidden border-continuous"
            style={{ width: iconWidth, opacity: resourceType === 'nave' ? 1 : 0.3 }}
          >
            <TouchableSvgIcon
              icon={NaveIcon}
              color={resourceType === 'nave' ? getUniverseColor('nave') : 'grey'}
              onPress={() => onPress('nave')}
              label={t('Thèmes')}
            />
          </Box>
          <Box
            className="overflow-hidden border-continuous"
            style={{ width: iconWidth, opacity: resourceType === 'reference' ? 1 : 0.3 }}
          >
            <TouchableSvgIcon
              icon={RefIcon}
              color={resourceType === 'reference' ? getUniverseColor('reference') : 'grey'}
              onPress={() => onPress('reference')}
              label={t('Références')}
            />
          </Box>
          <Box
            className="overflow-hidden border-continuous"
            style={{ width: iconWidth, opacity: resourceType === 'commentary' ? 1 : 0.3 }}
          >
            <TouchableSvgIcon
              icon={CommentIcon}
              color={resourceType === 'commentary' ? getUniverseColor('commentary') : 'grey'}
              onPress={() => onPress('commentary')}
              label={t('Comment.')}
            />
          </Box>
          <Box
            className="overflow-hidden border-continuous"
            style={{ width: iconWidth, opacity: resourceType === 'compare' ? 1 : 0.3 }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => onPress('compare')}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <FeatherIcon
                name="layers"
                size={20}
                color={resourceType === 'compare' ? getUniverseColor('compare') : 'grey'}
              />
              <Text className="mt-[5px] text-[9px] text-grey">{t('Comparer')}</Text>
            </TouchableOpacity>
          </Box>
        </HStack>
      </ScrollView>
    </Box>
  )
})

export default ResourcesModalFooter
