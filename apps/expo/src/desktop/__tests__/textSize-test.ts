jest.mock('~redux/modules/user', () => ({
  increaseSettingsFontSizeScale: jest.fn(),
  decreaseSettingsFontSizeScale: jest.fn(),
}))
jest.mock('react-redux', () => ({ useDispatch: jest.fn(), useStore: jest.fn() }))

import { textSizeSteps } from '../textSize'

describe('the text size from the View menu', () => {
  it('takes one step up or down', () => {
    expect(textSizeSteps(0, 'larger')).toEqual(['up'])
    expect(textSizeSteps(3, 'smaller')).toEqual(['down'])
  })

  it('goes back to the actual size through the setting’s own steps', () => {
    expect(textSizeSteps(3, 'reset')).toEqual(['down', 'down', 'down'])
    expect(textSizeSteps(-2, 'reset')).toEqual(['up', 'up'])
    expect(textSizeSteps(0, 'reset')).toEqual([])
  })
})
