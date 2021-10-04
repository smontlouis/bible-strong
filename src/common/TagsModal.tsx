import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, TouchableOpacity } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Box from '~common/ui/Box'
import Chip from '~common/ui/Chip'
import Text from '~common/ui/Text'
import TextInput from '~common/ui/TextInput'
import { hp } from '~helpers/utils'
import { addTag } from '~redux/modules/user'
import Modal from './Modal'
import SearchTagInput from './SearchTagInput'
import Spacer from './ui/Spacer'
import Fuse from 'fuse.js'

const StyledIcon = styled(Icon.Feather)(({ theme, isDisabled }) => ({
  marginLeft: 10,
  color: isDisabled ? theme.colors.border : theme.colors.primary,
}))

const TagsModal = ({ isVisible, onClosed, onSelected, selectedChip }) => {
  const [newTag, setNewTag] = useState('')
  const dispatch = useDispatch()
  const tags = useSelector(state => Object.values(state.user.bible.tags))
  const fuse = useMemo(() => new Fuse(tags, { keys: ['name'] }), [])
  const [filteredTags, setFilteredTags] = useState(tags)
  const { t } = useTranslation()
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    if (searchValue) {
      setFilteredTags(fuse.search(searchValue).map(v => v.item))
    } else {
      setFilteredTags(tags)
    }
  }, [searchValue, fuse])

  const saveTag = () => {
    if (!newTag.trim()) {
      return
    }
    dispatch(addTag(newTag.trim()))
    setNewTag('')
  }

  return (
    <Modal.Menu
      isOpen={isVisible}
      onClose={onClosed}
      HeaderComponent={
        <Box paddingTop={20} paddingBottom={10} paddingHorizontal={20}>
          <Text bold>{t('Étiquettes')}</Text>
          <Spacer />
          <SearchTagInput
            placeholder={t('Chercher une étiquette')}
            onChangeText={setSearchValue}
            value={searchValue}
            returnKeyType="done"
          />
        </Box>
      }
      FooterComponent={
        <Box row center marginBottom={10} marginLeft={20} marginRight={20}>
          <Box flex>
            <TextInput
              placeholder={t('Créer un nouveau tag')}
              onChangeText={setNewTag}
              onSubmitEditing={saveTag}
              returnKeyType="send"
              value={newTag}
            />
          </Box>
          <TouchableOpacity onPress={saveTag}>
            <StyledIcon isDisabled={!newTag} name="check" size={30} />
          </TouchableOpacity>
        </Box>
      }
      modalHeight={hp(80, 600)}
    >
      <Box flex>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          <Box row wrap>
            <Chip
              label={t('Tout')}
              isSelected={!selectedChip}
              onPress={() => onSelected(null)}
            />
            {filteredTags.map(chip => (
              <Chip
                key={chip.id}
                label={chip.name}
                isSelected={selectedChip && chip.name === selectedChip.name}
                onPress={() => onSelected(chip)}
              />
            ))}
          </Box>
        </ScrollView>
      </Box>
    </Modal.Menu>
  )
}

export default TagsModal
