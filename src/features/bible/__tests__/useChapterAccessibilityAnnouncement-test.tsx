import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { useChapterAccessibilityAnnouncement } from '../useChapterAccessibilityAnnouncement'

const mockAnnounceForAccessibility = jest.fn()

jest.mock('react-native', () => ({
  AccessibilityInfo: {
    announceForAccessibility: (...args: unknown[]) => mockAnnounceForAccessibility(...args),
  },
}))

const AnnouncementHarness = ({
  announcement,
  locationKey,
  ready,
}: {
  announcement: string
  locationKey: string
  ready: boolean
}) => {
  useChapterAccessibilityAnnouncement({ announcement, locationKey, ready })
  return null
}

describe('useChapterAccessibilityAnnouncement', () => {
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    mockAnnounceForAccessibility.mockClear()
  })

  it('does not announce the initial chapter', () => {
    act(() => {
      create(<AnnouncementHarness announcement="Genèse 10 chargé" locationKey="1:10:LSG" ready />)
    })

    expect(mockAnnounceForAccessibility).not.toHaveBeenCalled()
  })

  it('announces a changed chapter only after its content is ready', () => {
    let renderer: ReactTestRenderer

    act(() => {
      renderer = create(
        <AnnouncementHarness announcement="Genèse 10 chargé" locationKey="1:10:LSG" ready />
      )
    })

    act(() => {
      renderer!.update(
        <AnnouncementHarness announcement="Genèse 11 chargé" locationKey="1:11:LSG" ready={false} />
      )
    })

    expect(mockAnnounceForAccessibility).not.toHaveBeenCalled()

    act(() => {
      renderer!.update(
        <AnnouncementHarness announcement="Genèse 11 chargé" locationKey="1:11:LSG" ready />
      )
    })

    expect(mockAnnounceForAccessibility).toHaveBeenCalledTimes(1)
    expect(mockAnnounceForAccessibility).toHaveBeenCalledWith('Genèse 11 chargé')
  })
})
