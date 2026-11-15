import { useSelector } from 'react-redux'

import type { RootState } from '~redux/modules/reducer'
import { isCardCollectionEnabled } from '~redux/modules/user/settings'

/**
 * Whether the reader collects cards (ADR-0090), a setting of the Bible. Off, the chapters show no
 * dot, the characters' pages no card and the home no album; the cards already collected stay.
 */
export const useCardCollectionEnabled = () =>
  useSelector((state: RootState) =>
    isCardCollectionEnabled(state.user.bible.settings.cardCollection)
  )
