import React from 'react'
import Modal from 'react-native-modal'
import { useDispatch, useSelector } from 'react-redux'
import { Alert } from 'react-native'
import { getBottomSpace } from 'react-native-iphone-x-helper'

import { withTheme } from 'emotion-theming'
import styled from '@emotion/native'

import Text from '~common/ui/Text'
import { deleteStudy } from '~redux/modules/user'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0,
})

const Container = styled.View(({ theme }) => ({
  marginLeft: 'auto',
  marginRight: 'auto',
  width: '100%',
  maxWidth: 600,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,

  display: 'flex',
  backgroundColor: theme.colors.reverse,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  paddingBottom: getBottomSpace(),
}))

const Touchy = styled.TouchableOpacity(({ theme }) => ({
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  overflow: 'hidden',
}))

const StudySettingsModal = ({
  isOpen,
  onClosed,
  theme,
  setTitlePrompt,
  setMultipleTagsItem,
}) => {
  const dispatch = useDispatch()
  const studyId = isOpen
  const study = useSelector(state => state.user.bible.studies[studyId])

  const deleteStudyConfirmation = studyId => {
    Alert.alert('Attention', 'Voulez-vous vraiment supprimer cette étude?', [
      { text: 'Non', onPress: () => null, style: 'cancel' },
      {
        text: 'Oui',
        onPress: () => dispatch(deleteStudy(studyId), onClosed()),
        style: 'destructive',
      },
    ])
  }

  return (
    <StylizedModal
      backdropOpacity={0.3}
      isVisible={!!isOpen}
      avoidKeyboard
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}
    >
      <Container>
        <Touchy
          onPress={() => {
            onClosed()
            setTimeout(() => {
              setMultipleTagsItem({ ...study, entity: 'studies' })
            }, 500)
          }}
        >
          <Text fontSize={16} bold>
            Tags
          </Text>
        </Touchy>
        <Touchy
          onPress={() => {
            onClosed()
            setTimeout(() => {
              setTitlePrompt({ id: study.id, title: study.title })
            }, 500)
          }}
        >
          <Text fontSize={16} bold>
            Renommer
          </Text>
        </Touchy>
        <Touchy onPress={() => deleteStudyConfirmation(studyId)}>
          <Text fontSize={16} bold color="quart">
            Supprimer
          </Text>
        </Touchy>
      </Container>
    </StylizedModal>
  )
}

export default withTheme(StudySettingsModal)
