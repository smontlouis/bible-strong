import { OPEN_STRONG_SELECTION } from '../dispatch'
import { dispatchStrongSelection } from '../strongSelectionAction'

describe('dispatchStrongSelection', () => {
  it('keeps the version of the clicked Bible column', () => {
    const dispatch = jest.fn()

    dispatchStrongSelection(dispatch, ['H3068G', 'H0413'], 1, 'BSB')

    expect(dispatch).toHaveBeenCalledWith({
      type: OPEN_STRONG_SELECTION,
      payload: {
        book: 1,
        reference: '3068',
        references: ['H3068G', 'H0413'],
        version: 'BSB',
      },
    })
  })

  it('does not dispatch an invalid Strong selection', () => {
    const dispatch = jest.fn()

    dispatchStrongSelection(dispatch, ['invalid'], 1, 'LSG')

    expect(dispatch).not.toHaveBeenCalled()
  })
})
