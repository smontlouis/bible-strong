import { useEffect, useRef } from 'react'
import { AccessibilityInfo } from 'react-native'

type ChapterAccessibilityAnnouncementOptions = {
  announcement: string
  locationKey: string
  ready: boolean
}

export const useChapterAccessibilityAnnouncement = ({
  announcement,
  locationKey,
  ready,
}: ChapterAccessibilityAnnouncementOptions) => {
  const lastRequestedLocationKeyRef = useRef(locationKey)
  const shouldAnnounceRef = useRef(false)

  useEffect(() => {
    if (lastRequestedLocationKeyRef.current === locationKey) return

    lastRequestedLocationKeyRef.current = locationKey
    shouldAnnounceRef.current = true
  }, [locationKey])

  useEffect(() => {
    if (!shouldAnnounceRef.current || !ready) return

    shouldAnnounceRef.current = false
    AccessibilityInfo.announceForAccessibility(announcement)
  }, [announcement, ready])
}
