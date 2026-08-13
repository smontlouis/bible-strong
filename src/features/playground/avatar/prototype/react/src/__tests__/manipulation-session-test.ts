import { beginManipulation, finishManipulation, previewManipulation } from '../manipulationSession'

describe('pointer manipulation session', () => {
  it('previews many values and commits exactly once', () => {
    const previews: number[] = []
    const commits: number[] = []
    const session = beginManipulation(10)
    previewManipulation(session, 11, value => previews.push(value))
    previewManipulation(session, 12, value => previews.push(value))

    finishManipulation(session, 'commit', {
      preview: value => previews.push(value),
      commit: value => commits.push(value),
    })

    expect(previews).toEqual([11, 12])
    expect(commits).toEqual([12])
  })

  it('restores the initial value when pointer capture is cancelled', () => {
    const previews: number[] = []
    const session = beginManipulation(10)
    previewManipulation(session, 20, () => undefined)

    finishManipulation(session, 'cancel', {
      preview: value => previews.push(value),
      commit: () => undefined,
    })

    expect(previews).toEqual([10])
  })
})
