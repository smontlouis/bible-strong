import { useSetAtom } from 'jotai/react'
import { getDefaultBibleTab, tabsAtom, tabsAtomsAtom } from 'src/state/tabs'
import { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'

export const DebugView = () => {
  const setTabs = useSetAtom(tabsAtom)
  const addTabs = () => {
    setTabs((s) => [
      ...s,
      ...Array.from({ length: 100 }, (_, i) => ({
        ...getDefaultBibleTab(),
        id: `tab-${i}-${Date.now()}`,
        isRemovable: true,
      })),
    ])
  }

  const removeTabs = () => {
    setTabs([getDefaultBibleTab()])
  }
  return (
    <HStack gap={10}>
      <TouchableBox onPress={addTabs}>
        <Text>Add 100 tabs</Text>
      </TouchableBox>
      <TouchableBox onPress={removeTabs}>
        <Text>Remove all tabs</Text>
      </TouchableBox>
    </HStack>
  )
}
