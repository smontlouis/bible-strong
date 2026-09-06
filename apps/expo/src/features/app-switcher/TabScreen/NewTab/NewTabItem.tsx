import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import TabIcon from '~features/app-switcher/utils/getIconByTabType'
import { BibleTab, getDefaultBibleTab, getDefaultData, TabItem } from '../../../../state/tabs'
import { useDefaultBibleVersion } from '../../../../state/useDefaultBibleVersion'
import { useSelectBibleReference } from './SelectBibleReferenceModalProvider'
interface NewTabItemProps {
  type: TabItem['type']
  newAtom: PrimitiveAtom<TabItem>
  onPlanPress?: () => void
}

const useOpenTabByType = ({ type, newAtom, onPlanPress }: NewTabItemProps) => {
  const [tab, setTab] = useAtom(newAtom)
  const router = useRouter()
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
      type,
      data: getData(),
    } as TabItem)
  }

  const onPress = () => {
    if (type === 'strong') {
      router.push({ pathname: '/lexique', params: { mode: 'newTab', tabId: tab.id } })
      return
    }

    if (type === 'dictionary') {
      router.push({ pathname: '/dictionnaire', params: { mode: 'newTab', tabId: tab.id } })
      return
    }

    if (type === 'nave') {
      router.push({ pathname: '/nave', params: { mode: 'newTab', tabId: tab.id } })
      return
    }

    if (type === 'study') {
      router.push({ pathname: '/studies', params: { mode: 'newTab', tabId: tab.id } })
      return
    }

    if (type === 'notes') {
      router.push({ pathname: '/bible-verse-notes', params: { mode: 'newTab', tabId: tab.id } })
      return
    }

    if (type === 'plan') {
      onPlanPress?.()
      return
    }

    // Bible: ouvrir directement avec les données par défaut
    if (type === 'bible') {
      setTab({
        ...getDefaultBibleTab(defaultVersion),
        id: tab.id,
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

    setTab({ ...tab, base64Preview: '', type, ...getDefaultData(type) } as TabItem)
  }

  return {
    onPress,
  }
}

const NewTabItem = ({ type, newAtom, onPlanPress }: NewTabItemProps) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const { onPress } = useOpenTabByType({ type, newAtom, onPlanPress })

  return (
    <TouchableBox
      className="overflow-hidden border-continuous h-[72px] px-[18px] flex-row items-center bg-reverse rounded-[20px]"
      onPress={onPress}
    >
      <TabIcon type={type} size={26} />
      <Text
        className="ml-[16px] text-[16px]"
        style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
      >
        {t(`tabs.${type}`)}
      </Text>
    </TouchableBox>
  )
}

export default NewTabItem
