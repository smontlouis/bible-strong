import React, { useMemo } from 'react'

import { atom, useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { Modalize } from 'react-native-modalize'
import { useNavigation } from 'react-navigation-hooks'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import formatVerseContent from '~helpers/formatVerseContent'
import { CommentaryTab } from '~state/tabs'
import CommentariesTabScreen from './CommentariesTabScreen'
import produce from 'immer'
import PopOverMenu from '~common/PopOverMenu'
import MenuOption from '~common/ui/MenuOption'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'

const CommentariesModal = ({
  verse,
  onChangeVerse,
  onClose,
}: {
  verse: string | null
  onChangeVerse: React.Dispatch<React.SetStateAction<string | null>>
  onClose: () => void
}) => {
  const { t } = useTranslation()
  const ref = React.useRef<Modalize>(null)
  const navigation = useNavigation()
  const openInNewTab = useOpenInNewTab()

  const onTheFlyAtom = useMemo(
    () =>
      atom<CommentaryTab>({
        id: `commentary-${Date.now()}`,
        title: 'Commentaire',
        isRemovable: true,
        hasBackButton: true,
        type: 'commentary',
        data: {
          verse,
        },
      } as CommentaryTab),
    [verse]
  )

  const [commentaryTab] = useAtom(onTheFlyAtom)

  const { title } = commentaryTab

  return (
    <Modal.Body
      isOpen={!!verse}
      onClose={onClose}
      modalRef={ref}
      HeaderComponent={
        <ModalHeader
          onClose={() => ref?.current?.close()}
          title={title}
          subTitle={t('Par thèmes')}
          rightComponent={
            <PopOverMenu
              width={24}
              height={54}
              popover={
                <>
                  <MenuOption
                    onSelect={() => {
                      openInNewTab({
                        id: `commentary-${Date.now()}`,
                        title: t('tabs.new'),
                        isRemovable: true,
                        type: 'commentary',
                        data: {
                          verse: verse || '',
                        },
                      })
                    }}
                  >
                    <Box row alignItems="center">
                      <FeatherIcon name="external-link" size={15} />
                      <Text marginLeft={10}>{t('tab.openInNewTab')}</Text>
                    </Box>
                  </MenuOption>
                </>
              }
            />
          }
        />
      }
    >
      {verse && (
        <CommentariesTabScreen
          hasHeader={false}
          commentaryAtom={onTheFlyAtom}
          navigation={navigation}
        />
      )}
    </Modal.Body>
  )
}
export default CommentariesModal
