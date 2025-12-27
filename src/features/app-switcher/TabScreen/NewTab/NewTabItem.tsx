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
import { useSelectBibleReference } from './SelectBibleReferenceModalProvider'
import { useDefaultBibleVersion } from '../../../../state/useDefaultBibleVersion'

interface NewTabItemProps {
  type: TabItem['type']
  newAtom: PrimitiveAtom<NewTab>
}

const useOpenTabByType = ({ type, newAtom }: NewTabItemProps) => {
  const [tab, setTab] = useAtom(newAtom)
  const { openBibleReferenceModal } = useSelectBibleReference()
  const defaultVersion = useDefaultBibleVersion()

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

      return { ...getDefaultBibleTab(defaultVersion).data, ...data }
    }
    setTab({
      ...tab,
      // @ts-ignore
      type,
      data: getData(),
    })
  }

  const onPress = () => {
    // Bible: ouvrir directement avec les données par défaut
    if (type === 'bible') {
      setTab({
        ...tab,
        // @ts-ignore
        type: 'bible',
        data: getDefaultBibleTab(defaultVersion).data,
      })
      return
    }

    // Compare et Commentary: afficher le sélecteur de versets
    if (['compare', 'commentary'].includes(type)) {
      openBibleReferenceModal({
        onSelect: onBibleSelectDone,
      })
      return
    }

    // @ts-ignore
    setTab({ ...tab, base64Preview: '', type, ...getDefaultData(type) })
  }

  return {
    onPress,
  }
}

const NewTabItem = ({ type, newAtom }: NewTabItemProps) => {
  const { t } = useTranslation()
  const { onPress } = useOpenTabByType({ type, newAtom })

  return (
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
  )
}

export default NewTabItem
