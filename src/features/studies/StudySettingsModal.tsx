import React from 'react'
import Modal from 'react-native-modal'
import { useDispatch, useSelector } from 'react-redux'
import { Alert } from 'react-native'
import { getBottomSpace } from 'react-native-iphone-x-helper'

import { withTheme } from 'emotion-theming'
import styled from '~styled'

import Text from '~common/ui/Text'
import { deleteStudy } from '~redux/modules/user'
import { Theme } from '~themes'
import { RootState } from '~redux/modules/reducer'
import PublishStudyMenuItem from './PublishStudyMenuItem'
import { useTranslation } from 'react-i18next'

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

export const Touchy = styled.TouchableOpacity(({ theme }) => ({
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  overflow: 'hidden',
}))

interface Props {
  isOpen: string
  onClosed: () => void
  theme: Theme
  setTitlePrompt: (x: Object) => void
  setMultipleTagsItem: (x: Object) => void
}

const StudySettingsModal = ({
  isOpen,
  onClosed,
  theme,
  setTitlePrompt,
  setMultipleTagsItem,
}: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const studyId = isOpen
  const study = useSelector(
    (state: RootState) => state.user.bible.studies[studyId]
  )

  const deleteStudyConfirmation = (id: string) => {
    Alert.alert(
      t('Attention'),
      t('Voulez-vous vraiment supprimer cette étude?'),
      [
        { text: t('Non'), onPress: () => null, style: 'cancel' },
        {
          text: t('Oui'),
          onPress: () => {
            dispatch(deleteStudy(id))
            onClosed()
          },
          style: 'destructive',
        },
      ]
    )
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
        {study && <PublishStudyMenuItem study={study} onClosed={onClosed} />}
        <Touchy
          onPress={() => {
            onClosed()
            setTimeout(() => {
              setMultipleTagsItem({ ...study, entity: 'studies' })
            }, 500)
          }}
        >
          <Text>{t('Éditer les tags')}</Text>
        </Touchy>
        <Touchy
          onPress={() => {
            onClosed()
            setTimeout(() => {
              setTitlePrompt({ id: study.id, title: study.title })
            }, 500)
          }}
        >
          <Text>{t('Renommer')}</Text>
        </Touchy>
        <Touchy onPress={() => deleteStudyConfirmation(studyId)}>
          <Text color="quart">{t('Supprimer')}</Text>
        </Touchy>
      </Container>
    </StylizedModal>
  )
}

export default withTheme(StudySettingsModal)
