import { selectCompareVersions } from '../user'

describe('selectCompareVersions', () => {
  it('returns only versions explicitly enabled for comparison', () => {
    const state = {
      user: {
        bible: {
          settings: {
            compare: { LSG: true, KJV: false, DBY: true },
          },
        },
      },
    }

    expect(selectCompareVersions(state as never)).toEqual(['LSG', 'DBY'])
  })

  it('supports an empty explicit selection', () => {
    const state = {
      user: { bible: { settings: { compare: {} } } },
    }

    expect(selectCompareVersions(state as never)).toEqual([])
  })
})
