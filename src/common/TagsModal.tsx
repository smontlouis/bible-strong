import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, TouchableOpacity } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { shallowEqual } from 'recompose'
import Box from '~common/ui/Box'
import Chip from '~common/ui/Chip'
import Text from '~common/ui/Text'
import TextInput from '~common/ui/TextInput'
import useFuzzy from '~helpers/useFuzzy'
import { useModalize } from '~helpers/useModalize'
import { hp } from '~helpers/utils'
import { RootState } from '~redux/modules/reducer'
import { addTag } from '~redux/modules/user'
import { sortedTagsSelector } from '~redux/selectors/tags'
import Modal from './Modal'
import SearchInput from './SearchInput'
import Spacer from './ui/Spacer'

const StyledIcon = styled(Icon.Feather)(({ theme, isDisabled }) => ({
  marginLeft: 10,
  color: isDisabled ? theme.colors.border : theme.colors.primary,
}))

const TagsModal = ({ isVisible, onClosed, onSelected, selectedChip }) => {
  const [newTag, setNewTag] = useState('')
  const { ref, open } = useModalize()

  // Refactor this
  useEffect(() => {
    if (isVisible) {
      open()
    }
  }, [isVisible, open])

  const dispatch = useDispatch()
  const tags = useSelector(sortedTagsSelector, shallowEqual)
  const { keyword, result, search, resetSearch } = useFuzzy(tags, {
    keys: ['name'],
  })
  const { t } = useTranslation()

  const saveTag = () => {
    if (!newTag.trim()) {
      return
    }
    dispatch(addTag(newTag.trim()))
    setNewTag('')
  }

  return (
    <Modal.Body
      ref={ref}
      onClose={onClosed}
      HeaderComponent={
        <Box paddingTop={20} paddingBottom={10} paddingHorizontal={20}>
          <Text bold>{t('Étiquettes')}</Text>
          <Spacer />
          <SearchInput
            placeholder={t('Chercher une étiquette')}
            onChangeText={search}
            onDelete={resetSearch}
            value={keyword}
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
            {result.map(chip => (
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
    </Modal.Body>
  )
}

export default TagsModal
