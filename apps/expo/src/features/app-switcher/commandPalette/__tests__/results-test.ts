import { destinations, findPassages, findTabs, matchesQuery } from '../results'
import type { TabGroup } from '~state/tabs'
jest.mock('../../../../../i18n', () => ({ getLanguage: () => 'fr' }))

describe('command palette results', () => {
  it('matches accents, case, aliases and separate words', () => {
    expect(matchesQuery('ETU', 'Études')).toBe(true)
    expect(matchesQuery('LSG jean', 'Jean 3', 'LSG')).toBe(true)
    expect(
      destinations.filter(item => matchesQuery('lexique', item.aliases)).map(item => item.type)
    ).toEqual(['strong'])
    expect(matchesQuery('foobar', 'Bible')).toBe(false)
  })
  it.each(['Jean 3', 'Jn 3:16', 'Jean 3:16-18'])('recognizes complete reference %s', query => {
    const [passage] = findPassages(query, 'fr')
    expect(passage.target.book).toBe(43)
    expect(passage.target.chapter).toBe(3)
  })
  it('retains the selected verse range', () => {
    expect(findPassages('Jean 3:16-18', 'fr')[0].target.focusVerses).toEqual([16, 17, 18])
  })
  it('does not interpret arbitrary text containing a reference as a navigation command', () => {
    expect(findPassages('parler de Jean 3:16', 'fr')).toEqual([])
    expect(findPassages('Jean 999:999', 'fr')).toEqual([])
    expect(findPassages('', 'fr')).toEqual([])
  })
  it('finds tabs across groups and orders them by recent use', () => {
    const groups: TabGroup[] = ['first', 'second'].map(id => ({
      id,
      name: id,
      isDefault: false,
      activeTabIndex: 0,
      createdAt: 0,
      updatedAt: 0,
      tabs: [
        {
          id,
          title: id === 'first' ? 'Étude' : 'Note',
          isRemovable: true,
          type: 'notes',
          data: {},
        },
        { id: `new-${id}`, type: 'new', title: 'New', isRemovable: true, data: {} },
      ],
    }))
    expect(findTabs(groups, '', ['second']).map(item => item.tab.id)).toEqual(['second', 'first'])
    expect(findTabs(groups, 'etude', [])[0].groupId).toBe('first')
    expect(findTabs(groups, 'second', [])[0].tab.id).toBe('second')
  })
})
