import { useDispatch, useStore } from 'react-redux'

import { decreaseSettingsFontSizeScale, increaseSettingsFontSizeScale } from '~redux/modules/user'
import type { RootState } from '~redux/modules/reducer'

/** What View › Make Text Bigger, Smaller and Actual Size ask (⌘=, ⌘−, ⌘0). */
export type TextSizeChange = 'larger' | 'smaller' | 'reset'

/**
 * The steps of the reader's text size setting (-5 to 5, the reducer keeps the bounds) that make
 * the change. Actual Size goes back to 0 through the same steps the settings take, so the
 * change syncs as theirs does.
 */
export const textSizeSteps = (scale: number, change: TextSizeChange): ('up' | 'down')[] => {
  if (change === 'larger') return ['up']
  if (change === 'smaller') return ['down']
  return Array.from({ length: Math.abs(scale) }, () => (scale > 0 ? 'down' : 'up'))
}

export const useTextSizeChange = () => {
  const dispatch = useDispatch()
  const store = useStore<RootState>()
  return (change: TextSizeChange) => {
    const scale = store.getState().user.bible.settings.fontSizeScale
    for (const step of textSizeSteps(scale, change)) {
      dispatch(step === 'up' ? increaseSettingsFontSizeScale() : decreaseSettingsFontSizeScale())
    }
  }
}
