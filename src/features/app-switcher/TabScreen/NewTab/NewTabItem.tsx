import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import getIconByTabType from '~features/app-switcher/utils/getIconByTabType'
import { useDisclosure } from '~helpers/useDisclosure'
import {
  BibleTab,
  getDefaultData,
  NewTab,
  getDefaultBibleTab,
  TabItem,
} from '../../../../state/tabs'
import SelectBibleReferenceModal from './SelectBibleReferenceModal'

interface NewTabItemProps {
  type: TabItem['type']
  newAtom: PrimitiveAtom<NewTab>
}

const useOpenTabByType = ({ type, newAtom }: NewTabItemProps) => {
  const [tab, setTab] = useAtom(newAtom)
  const {
    isOpen: isBibleSelectOpen,
    onOpen: onBibleSelectOpen,
    onClose: onBibleSelectClose,
  } = useDisclosure()

  const onBibleSelectDone = (data: BibleTab['data']['temp']) => {
    const getData = () => {
      const reference = `${data.selectedBook.Numero}-${data.selectedChapter}-${data.selectedVerse}`

      if (type === 'compare') {
        return {
          selectedVerses: { [reference]: true },
        }
      }
      if (type === 'commentary') {
        return {
          verse: reference,
        }
      }

      return { ...getDefaultBibleTab().data, ...data }
    }
    setTab({
      ...tab,
      // @ts-ignore
      type,
      data: getData(),
    })
  }

  const onPress = () => {
    if (['compare', 'commentary', 'bible'].includes(type)) {
      onBibleSelectOpen()
      return
    }
    // @ts-ignore
    setTab({ ...tab, base64Preview: '', type, ...getDefaultData(type) })
  }

  return {
    onPress,
    onBibleSelectDone,
    isBibleSelectOpen,
    onBibleSelectClose,
    onBibleSelectOpen,
  }
}

const NewTabItem = ({ type, newAtom }: NewTabItemProps) => {
  const { t } = useTranslation()
  const {
    onPress,
    onBibleSelectDone,
    onBibleSelectClose,
    isBibleSelectOpen,
  } = useOpenTabByType({
    type,
    newAtom,
  })

  return (
    <>
      <TouchableBox
        width={150}
        height={100}
        mt={20}
        mx={10}
        center
        bg="reverse"
        rounded
        onPress={onPress}
      >
        {getIconByTabType(type, 26)}
        <Text opacity={0.4} title mt={8} fontSize={14} lightShadow>
          {t(`tabs.${type}`)}
        </Text>
      </TouchableBox>
      <SelectBibleReferenceModal
        onSelect={onBibleSelectDone}
        isOpen={isBibleSelectOpen}
        onClose={onBibleSelectClose}
      />
    </>
  )
}

export default NewTabItem
