import { selectStudyListRows } from '../studies'
import type { RootState } from '~redux/modules/reducer'

describe('selectStudyListRows', () => {
  it('flattens rich content once per studies state change', () => {
    const studies = {
      study1: {
        id: 'study1',
        title: 'Grâce',
        content: { ops: [{ insert: 'Texte riche\n' }] },
        created_at: 1,
        modified_at: 2,
      },
    }
    const state = { user: { bible: { studies } } } as unknown as RootState

    const first = selectStudyListRows(state)
    const second = selectStudyListRows(state)

    expect(first[0].searchDescription).toBe('Texte riche\n')
    expect(second).toBe(first)
  })
})
