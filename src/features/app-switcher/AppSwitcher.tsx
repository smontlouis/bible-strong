import { PrimitiveAtom, useAtom } from 'jotai'
import { TabItem, tabsAtomsAtom } from '../../state/tabs'

const AppSwitcher = () => {
  const [tabsAtoms] = useAtom(tabsAtomsAtom)

  return tabsAtoms.map(atom => <Tab atom={atom} />)
}

const Tab = ({ atom }: { atom: PrimitiveAtom<TabItem> }) => {
  const [tab] = useAtom(atom)

  if (tab.type === 'bible') {
    return <BibleTab atom={atom} />
  }

  return null
}

export default AppSwitcher
