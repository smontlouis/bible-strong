import { atom } from 'jotai/vanilla'
import { useState } from 'react'

import generateUUID from '~helpers/generateUUID'
import type { StrongTab } from '~state/tabs'
import StrongDetailScreen from './StrongDetailScreen'
import type { StrongDetailPage, StrongDetailRouteContext } from './strongDetailRoutes'

type Props = {
  context: StrongDetailRouteContext
  isFormSheet?: boolean
  page: Exclude<StrongDetailPage, 'entity'>
}

const StrongDetailRouteScreen = ({ context, isFormSheet, page }: Props) => {
  const [strongAtom] = useState(() =>
    atom<StrongTab>({
      id: `strong-${generateUUID()}`,
      title: 'Lexique',
      isRemovable: true,
      hasBackButton: true,
      type: 'strong',
      data: context,
    })
  )

  return <StrongDetailScreen strongAtom={strongAtom} isFormSheet={isFormSheet} initialPage={page} />
}

export default StrongDetailRouteScreen
